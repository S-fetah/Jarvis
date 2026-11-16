/**
 * Renderer-side Web Audio Services for Microphone Capture and Audio Playback.
 */

export interface RecordedAudio {
  data: Uint8Array
  sampleRateHz: number
  channels: 1
  format: 'pcm16'
}

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private recordedChunks: Float32Array[] = []
  private isRecordingActive = false
  private levelListeners: ((level: number) => void)[] = []

  async startRecording(): Promise<void> {
    if (this.isRecordingActive) return

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.audioContext = new AudioContextClass({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

    // ScriptProcessor (bufferSize = 2048, 1 in, 1 out)
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1)
    this.recordedChunks = []

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecordingActive) return
      const inputData = e.inputBuffer.getChannelData(0)
      this.recordedChunks.push(new Float32Array(inputData))

      // Calculate RMS for visual audio level (0.0 to 1.0)
      let sum = 0
      const int16 = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const val = inputData[i]
        sum += val * val
        const s = Math.max(-1, Math.min(1, val))
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      const rms = Math.min(1.0, Math.sqrt(sum / inputData.length) * 5)
      for (const listener of this.levelListeners) {
        listener(rms)
      }

      // Stream frame to Silero VAD engine for real-time speech boundary & barge-in
      if (window.jarvisAPI?.voiceProcessChunk) {
        window.jarvisAPI.voiceProcessChunk(int16).catch(() => {})
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
    this.isRecordingActive = true
  }

  async stopRecording(): Promise<RecordedAudio> {
    this.isRecordingActive = false

    if (this.source && this.processor) {
      this.source.disconnect()
      this.processor.disconnect()
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      await this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    // Reset level
    for (const listener of this.levelListeners) {
      listener(0)
    }

    // Concatenate chunks
    let totalLength = 0
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length
    }

    if (totalLength === 0) {
      return {
        data: new Uint8Array(0),
        sampleRateHz: 16000,
        channels: 1,
        format: 'pcm16'
      }
    }

    const mergedFloat32 = new Float32Array(totalLength)
    let offset = 0
    let peak = 0
    for (const chunk of this.recordedChunks) {
      mergedFloat32.set(chunk, offset)
      offset += chunk.length
    }

    for (let i = 0; i < totalLength; i++) {
      const abs = Math.abs(mergedFloat32[i])
      if (abs > peak) peak = abs
    }

    // Normalization: boost quiet microphone input up to 4x to ensure high Whisper accuracy
    const gain = peak > 0.01 ? Math.min(4.0, 0.9 / peak) : 1.0

    // 100ms silence padding (1600 samples @ 16kHz) front and back to protect Whisper boundaries
    const padSamples = 1600
    const finalLength = totalLength + padSamples * 2
    const int16Array = new Int16Array(finalLength)

    for (let i = 0; i < totalLength; i++) {
      const s = Math.max(-1, Math.min(1, mergedFloat32[i] * gain))
      int16Array[padSamples + i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    return {
      data: new Uint8Array(int16Array.buffer),
      sampleRateHz: 16000,
      channels: 1,
      format: 'pcm16'
    }
  }

  isRecording(): boolean {
    return this.isRecordingActive
  }

  onLevel(listener: (level: number) => void): () => void {
    this.levelListeners.push(listener)
    return () => {
      this.levelListeners = this.levelListeners.filter((l) => l !== listener)
    }
  }
}

export class AudioPlaybackService {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isCurrentlyPlaying = false
  private stateListeners: ((playing: boolean) => void)[] = []

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioContext = new AudioContextClass()
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }
    return this.audioContext
  }

  async play(audioBytes: Uint8Array | number[]): Promise<void> {
    this.stop()

    const rawBuffer = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes)
    const ctx = this.getAudioContext()

    // Decode audio bytes (MP3, WAV, etc.)
    const audioBuffer = await ctx.decodeAudioData(rawBuffer.buffer.slice(0) as ArrayBuffer)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    this.currentSource = source
    this.setPlaying(true)

    return new Promise((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null
          this.setPlaying(false)
        }
        resolve()
      }
      source.start(0)
    })
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop(0)
        this.currentSource.disconnect()
      } catch {}
      this.currentSource = null
    }
    this.setPlaying(false)
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying
  }

  onStateChange(listener: (playing: boolean) => void): () => void {
    this.stateListeners.push(listener)
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener)
    }
  }

  private setPlaying(playing: boolean): void {
    if (this.isCurrentlyPlaying === playing) return
    this.isCurrentlyPlaying = playing
    for (const listener of this.stateListeners) {
      listener(playing)
    }
  }
}

export const globalAudioCapture = new AudioCaptureService()
export const globalAudioPlayback = new AudioPlaybackService()

// Auto-mute audio playback on instant barge-in interruption
if (typeof window !== 'undefined' && window.jarvisAPI?.onVoiceEvent) {
  window.jarvisAPI.onVoiceEvent((event: any) => {
    if (event?.type === 'voice:interrupted') {
      globalAudioPlayback.stop()
    }
  })
}
