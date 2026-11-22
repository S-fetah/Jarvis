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

interface QueuedAudioChunk {
  audioBytes: Uint8Array | number[]
  sampleRate: number
  resolve: () => void
  reject: (err: any) => void
}

export class AudioPlaybackService {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private isCurrentlyPlaying = false
  private stateListeners: ((playing: boolean) => void)[] = []
  private playbackQueue: QueuedAudioChunk[] = []
  private generationId = 0

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioContext = new AudioContextClass()
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }
    return this.audioContext
  }

  private async decodeAudio(
    ctx: AudioContext,
    rawBuffer: Uint8Array,
    sampleRate: number
  ): Promise<AudioBuffer> {
    try {
      return await ctx.decodeAudioData(
        rawBuffer.buffer.slice(
          rawBuffer.byteOffset,
          rawBuffer.byteOffset + rawBuffer.byteLength
        ) as ArrayBuffer
      )
    } catch {
      // Direct raw PCM fallback if container header is missing
      const sampleCount = Math.floor(rawBuffer.byteLength / 2)
      const int16 = new Int16Array(rawBuffer.buffer, rawBuffer.byteOffset, sampleCount)
      const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate)
      const channelData = audioBuffer.getChannelData(0)
      for (let i = 0; i < sampleCount; i++) {
        channelData[i] = int16[i] / 32768.0
      }
      return audioBuffer
    }
  }

  /**
   * Plays audio immediately, clearing any active playback and queued chunks.
   */
  async play(audioBytes: Uint8Array | number[], sampleRate = 24000): Promise<void> {
    this.stop()
    return this.enqueue(audioBytes, sampleRate)
  }

  /**
   * Enqueues an audio chunk for seamless, gapless playback.
   * If nothing is currently playing, starts immediately.
   */
  enqueue(audioBytes: Uint8Array | number[], sampleRate = 24000): Promise<void> {
    const rawBuffer = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes)
    if (rawBuffer.length === 0) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      this.playbackQueue.push({ audioBytes: rawBuffer, sampleRate, resolve, reject })
      if (!this.isCurrentlyPlaying) {
        void this.playNextQueueItem()
      }
    })
  }

  private async playNextQueueItem(): Promise<void> {
    if (this.playbackQueue.length === 0) {
      this.setPlaying(false)
      return
    }

    const currentGen = this.generationId
    const item = this.playbackQueue.shift()!
    const rawBuffer =
      item.audioBytes instanceof Uint8Array ? item.audioBytes : new Uint8Array(item.audioBytes)

    const ctx = this.getAudioContext()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await this.decodeAudio(ctx, rawBuffer, item.sampleRate)
    } catch (err) {
      item.reject(err)
      void this.playNextQueueItem()
      return
    }

    if (this.generationId !== currentGen) {
      item.resolve()
      return
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    this.currentSource = source
    this.setPlaying(true)

    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null
      }
      item.resolve()
      if (this.generationId === currentGen) {
        void this.playNextQueueItem()
      }
    }

    source.start(0)
  }

  stop(): void {
    this.generationId++
    while (this.playbackQueue.length > 0) {
      const item = this.playbackQueue.shift()
      item?.resolve()
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop(0)
        this.currentSource.disconnect()
      } catch {}
      this.currentSource = null
    }
    this.setPlaying(false)
  }

  getQueueLength(): number {
    return this.playbackQueue.length
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

/**
 * Splits cleaned speech text into natural spoken sentence chunks for pipelined synthesis and playback.
 */
export function splitSentencesForSpeech(text: string): string[] {
  if (!text || !text.trim()) return []

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\|.*\|$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~^|\\<>[\]{}]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+•]\s+/gm, '')
    .replace(/^[\s]*\d+[.)]\s+/gm, '')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}\u{20E3}]/gu,
      ''
    )
    .replace(/&/g, ' and ')
    .replace(/%/g, ' percent ')
    .replace(/@/g, ' at ')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/:\s*\./g, ': ')
    .replace(/([.!?])\s*\./g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim()

  if (!cleaned) return []

  const protectedText = cleaned
    .replace(/\be\.g\./gi, 'e___dot___g___dot___')
    .replace(/\bi\.e\./gi, 'i___dot___e___dot___')
    .replace(/\betc\./gi, 'etc___dot___')
    .replace(/\bvs\./gi, 'vs___dot___')
    .replace(/\b(mr|mrs|ms|dr|prof|sr|jr)\./gi, '$1___dot___')
    .replace(/(\d+)\.(\d+)/g, '$1___dot___$2')

  const rawParts = protectedText.match(/[^.!?]+(?:[.!?]+|$)/g) || [protectedText]
  const sentences: string[] = []
  let buffer = ''

  for (const part of rawParts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    buffer = buffer ? `${buffer} ${trimmed}` : trimmed

    const isFirstIntro =
      sentences.length === 0 &&
      buffer.length >= 10 &&
      /(?:sir|certainly|absolutely|indeed|welcome|hello|morning|evening|afternoon|understood)[.!?]$/i.test(
        buffer
      )

    if (/[.!?]$/.test(buffer) && (isFirstIntro || buffer.length >= 25)) {
      const restored = buffer.replace(/___dot___/g, '.')
      sentences.push(restored)
      buffer = ''
    }
  }

  if (buffer.trim()) {
    sentences.push(buffer.trim().replace(/___dot___/g, '.'))
  }

  return sentences
}

/**
 * Pipelined speech streaming controller.
 * Synthesizes and plays back sentences sequentially, so the user hears audio immediately
 * while remaining sentences are fetched and buffered in the background.
 */
let activePipelinedSpeechSession = 0

export async function speakPipelinedSpeech(
  text: string,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const sessionId = ++activePipelinedSpeechSession
  globalAudioPlayback.stop()

  const sentences = splitSentencesForSpeech(text)
  if (sentences.length === 0 || !window.jarvisAPI?.voiceSynthesize) return

  // 1. Synthesize and play the first sentence immediately (near-instant Time-To-First-Audio)
  try {
    const firstAudio = await window.jarvisAPI.voiceSynthesize(sentences[0])
    if (activePipelinedSpeechSession !== sessionId || options?.signal?.aborted) return

    if (firstAudio?.data && firstAudio.data.length > 0) {
      void globalAudioPlayback.enqueue(firstAudio.data, firstAudio.sampleRateHz || 24000)
    }
  } catch (err) {
    console.warn('[Jarvis Voice] Failed to synthesize first sentence:', err)
  }

  // 2. Synthesize subsequent sentences in background pipeline
  for (let i = 1; i < sentences.length; i++) {
    if (activePipelinedSpeechSession !== sessionId || options?.signal?.aborted) break

    try {
      const audio = await window.jarvisAPI.voiceSynthesize(sentences[i])
      if (activePipelinedSpeechSession !== sessionId || options?.signal?.aborted) break

      if (audio?.data && audio.data.length > 0) {
        void globalAudioPlayback.enqueue(audio.data, audio.sampleRateHz || 24000)
      }
    } catch (err) {
      console.warn(`[Jarvis Voice] Failed to synthesize sentence ${i + 1}:`, err)
    }
  }
}

// Auto-mute audio playback on instant barge-in interruption
if (typeof window !== 'undefined' && window.jarvisAPI?.onVoiceEvent) {
  window.jarvisAPI.onVoiceEvent((event: any) => {
    if (event?.type === 'voice:interrupted') {
      activePipelinedSpeechSession++
      globalAudioPlayback.stop()
    }
  })
}
