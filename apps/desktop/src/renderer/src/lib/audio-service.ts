/**
 * Renderer-side Web Audio Services for Microphone Capture and Audio Playback.
 */

export interface RecordedAudio {
  data: Uint8Array
  sampleRateHz: number
  channels: 1
  format: 'pcm16'
}

export interface AudioCaptureOptions {
  onInterim?: (text: string) => void
  interimIntervalMs?: number
}

const WORKLET_PROCESSOR_CODE = `
class MicrophoneCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('microphone-capture-processor', MicrophoneCaptureProcessor);
`

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private silentGain: GainNode | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private recordedChunks: Float32Array[] = []
  private isRecordingActive = false
  private levelListeners: ((level: number) => void)[] = []
  private interimTimer: number | null = null
  private isInterimInFlight = false
  private lastInterimLength = 0

  async startRecording(options?: AudioCaptureOptions): Promise<void> {
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

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.audioContext = new AudioContextClass({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.recordedChunks = []

    let workletSuccess = false
    if (this.audioContext.audioWorklet) {
      try {
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' })
        const workletUrl = URL.createObjectURL(blob)
        await this.audioContext.audioWorklet.addModule(workletUrl)
        URL.revokeObjectURL(workletUrl)

        this.workletNode = new AudioWorkletNode(this.audioContext, 'microphone-capture-processor')
        this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
          if (!this.isRecordingActive) return
          this.processInputChunk(event.data)
        }
        this.source.connect(this.workletNode)
        this.silentGain = this.audioContext.createGain()
        this.silentGain.gain.value = 0
        this.workletNode.connect(this.silentGain)
        this.silentGain.connect(this.audioContext.destination)
        workletSuccess = true
      } catch {
        workletSuccess = false
      }
    }

    if (!workletSuccess) {
      // Legacy fallback for environments lacking AudioWorklet
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1)
      this.processor.onaudioprocess = (e) => {
        if (!this.isRecordingActive) return
        this.processInputChunk(e.inputBuffer.getChannelData(0))
      }
      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
    }

    this.isRecordingActive = true
    this.lastInterimLength = 0

    // Periodic interim recognition loop (real-time mimicry every ~1.8s)
    const transcribe = window.jarvisAPI?.voiceTranscribe
    if (options?.onInterim && transcribe) {
      const onInterim = options.onInterim
      const intervalMs = options.interimIntervalMs ?? 1800
      this.interimTimer = window.setInterval(async () => {
        if (!this.isRecordingActive || this.isInterimInFlight) return

        const snapshot = this.getSnapshotAudio()
        if (!snapshot || snapshot.data.length === this.lastInterimLength) return

        this.isInterimInFlight = true
        this.lastInterimLength = snapshot.data.length

        try {
          const res = await transcribe(snapshot)
          if (this.isRecordingActive && res?.text) {
            onInterim(res.text)
          }
        } catch {
          // Interim transcription error non-fatal; final pass will retry
        } finally {
          this.isInterimInFlight = false
        }
      }, intervalMs)
    }
  }

  private processInputChunk(inputData: Float32Array): void {
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

  getSnapshotAudio(): RecordedAudio | null {
    if (!this.isRecordingActive || this.recordedChunks.length === 0) return null

    let totalLength = 0
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length
    }

    // Require at least 500ms of audio (8000 samples @ 16kHz)
    if (totalLength < 8000) return null

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

    if (peak < 0.015) return null

    const gain = Math.min(4.0, 0.9 / peak)
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

  async stopRecording(): Promise<RecordedAudio> {
    this.isRecordingActive = false

    if (this.interimTimer !== null) {
      clearInterval(this.interimTimer)
      this.interimTimer = null
    }
    this.isInterimInFlight = false

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.silentGain) {
      this.silentGain.disconnect()
      this.silentGain = null
    }

    if (this.source && this.processor) {
      this.source.disconnect()
      this.processor.disconnect()
      this.processor = null
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
