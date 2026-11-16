import { EventEmitter } from 'events'
import type { AudioInput, VADProvider } from '../types'
import { SileroVADProvider } from '../providers/vad/silero-vad-provider'

export interface SpeechBoundaryDetectorConfig {
  vadProvider?: VADProvider
  sampleRateHz?: number
  frameSize?: number // Default: 512 (32ms at 16kHz)
  speechThreshold?: number // Default: 0.5
  minSpeechFrames?: number // Default: 2 (64ms)
  silenceTimeoutMs?: number // Default: 500ms
  maxSpeechDurationMs?: number // Default: 30000ms (30s)
}

export class SpeechBoundaryDetector extends EventEmitter {
  private readonly vad: VADProvider
  private readonly sampleRateHz: number
  private readonly frameSize: number
  private readonly speechThreshold: number
  private readonly minSpeechFrames: number
  private readonly silenceTimeoutMs: number
  private readonly maxSpeechDurationMs: number

  private isSpeaking = false
  private consecutiveSpeechFrames = 0
  private consecutiveSilenceMs = 0
  private speechDurationMs = 0
  private accumulatedFrames: Int16Array[] = []
  private residualBuffer: Int16Array = new Int16Array(0)

  constructor(config?: SpeechBoundaryDetectorConfig) {
    super()
    this.vad = config?.vadProvider || new SileroVADProvider({ threshold: config?.speechThreshold ?? 0.5 })
    this.sampleRateHz = config?.sampleRateHz || 16000
    this.frameSize = config?.frameSize || 512
    this.speechThreshold = config?.speechThreshold ?? 0.5
    this.minSpeechFrames = config?.minSpeechFrames ?? 2
    this.silenceTimeoutMs = config?.silenceTimeoutMs ?? 500
    this.maxSpeechDurationMs = config?.maxSpeechDurationMs ?? 30000
  }

  /**
   * Processes a chunk of incoming raw PCM16 audio.
   * Splits into fixed 512-sample frames and runs VAD.
   */
  async processAudioChunk(pcm16Chunk: Int16Array): Promise<void> {
    // Combine with residual buffer from previous chunk
    const totalLength = this.residualBuffer.length + pcm16Chunk.length
    const combined = new Int16Array(totalLength)
    combined.set(this.residualBuffer, 0)
    combined.set(pcm16Chunk, this.residualBuffer.length)

    let offset = 0
    const frameMs = (this.frameSize / this.sampleRateHz) * 1000

    while (offset + this.frameSize <= combined.length) {
      const frame = combined.subarray(offset, offset + this.frameSize)
      offset += this.frameSize

      const prob = this.vad.processFrameProb
        ? await this.vad.processFrameProb(frame, this.sampleRateHz)
        : (this.vad.processFrame(frame, this.sampleRateHz) ? 1.0 : 0.0)
      const hasSpeech = prob >= this.speechThreshold

      this.emit('frame', {
        prob,
        hasSpeech,
        isSpeaking: this.isSpeaking
      })

      if (hasSpeech) {
        this.consecutiveSpeechFrames++
        this.consecutiveSilenceMs = 0

        if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.minSpeechFrames) {
          this.isSpeaking = true
          this.speechDurationMs = 0
          this.emit('speechStart')
        }
      } else {
        this.consecutiveSpeechFrames = 0
        if (this.isSpeaking) {
          this.consecutiveSilenceMs += frameMs
        }
      }

      if (this.isSpeaking) {
        this.speechDurationMs += frameMs
        this.accumulatedFrames.push(new Int16Array(frame))

        // Trigger speech end if silence timeout exceeded OR max speech duration reached
        if (
          this.consecutiveSilenceMs >= this.silenceTimeoutMs ||
          this.speechDurationMs >= this.maxSpeechDurationMs
        ) {
          this.triggerSpeechEnd()
        }
      }
    }

    // Save remainder for next chunk
    this.residualBuffer = new Int16Array(combined.subarray(offset))
  }

  private triggerSpeechEnd(): void {
    if (!this.isSpeaking) return
    this.isSpeaking = false

    // Concatenate accumulated frames into final AudioInput
    let totalSamples = 0
    for (const f of this.accumulatedFrames) {
      totalSamples += f.length
    }

    const merged = new Int16Array(totalSamples)
    let offset = 0
    for (const f of this.accumulatedFrames) {
      merged.set(f, offset)
      offset += f.length
    }

    this.accumulatedFrames = []
    this.consecutiveSilenceMs = 0
    this.consecutiveSpeechFrames = 0
    this.speechDurationMs = 0
    this.vad.reset()

    const audioInput: AudioInput = {
      data: new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength),
      sampleRateHz: this.sampleRateHz,
      channels: 1,
      format: 'pcm16'
    }

    this.emit('speechEnd', audioInput)
  }

  reset(): void {
    this.isSpeaking = false
    this.consecutiveSpeechFrames = 0
    this.consecutiveSilenceMs = 0
    this.speechDurationMs = 0
    this.accumulatedFrames = []
    this.residualBuffer = new Int16Array(0)
    this.vad.reset()
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking
  }
}
