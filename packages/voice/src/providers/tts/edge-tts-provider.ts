import type {
  AudioChunk,
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'

export interface EdgeTTSConfig {
  voice?: string // Default: en-GB-RyanNeural or en-US-ChristopherNeural
  rate?: string // Default: +0%
  pitch?: string // Default: +0Hz
  timeoutMs?: number // Default: 4000ms
}

export class EdgeTTSProvider implements TextToSpeechProvider {
  readonly id = 'edge-tts'
  readonly locality = 'cloud' as const

  private readonly defaultVoice: string
  private readonly defaultRate: string
  private readonly defaultPitch: string
  private readonly timeoutMs: number

  constructor(config?: EdgeTTSConfig) {
    this.defaultVoice = config?.voice || 'en-GB-RyanNeural'
    this.defaultRate = config?.rate || '+0%'
    this.defaultPitch = config?.pitch || '+0Hz'
    this.timeoutMs = config?.timeoutMs || 4000
  }

  supportsStreaming(): boolean {
    return true
  }

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const startTime = Date.now()
    const voice = options?.voice || this.defaultVoice
    const speedRatio = options?.speed ?? 1.0
    const ratePercent = `${speedRatio >= 1.0 ? '+' : ''}${Math.round((speedRatio - 1.0) * 100)}%`

    // Dynamically load @travisvn/edge-tts
    const { Communicate } = await import('@travisvn/edge-tts')
    const communicate = new Communicate(text, {
      voice,
      rate: ratePercent || this.defaultRate,
      pitch: this.defaultPitch
    })

    const audioBuffers: Buffer[] = []
    let timeoutId: NodeJS.Timeout | null = null

    const streamPromise = (async () => {
      for await (const chunk of communicate.stream()) {
        if (options?.signal?.aborted) break
        if (chunk.type === 'audio' && chunk.data) {
          audioBuffers.push(Buffer.from(chunk.data))
        }
      }
    })()

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Edge TTS synthesis timed out after ${this.timeoutMs}ms`))
      }, this.timeoutMs)
    })

    try {
      await Promise.race([streamPromise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    const fullAudio = Buffer.concat(audioBuffers)
    if (fullAudio.length === 0) {
      throw new Error('Edge TTS returned empty audio payload.')
    }

    return {
      data: new Uint8Array(fullAudio),
      sampleRateHz: 24000,
      format: 'mp3',
      durationMs: Date.now() - startTime
    }
  }

  async *synthesizeStream(
    chunks: AsyncIterable<string>,
    options?: SpeechOptions
  ): AsyncIterable<AudioChunk> {
    for await (const chunk of chunks) {
      if (options?.signal?.aborted) break
      const trimmed = chunk.trim()
      if (!trimmed) continue

      const output = await this.synthesize(trimmed, options)
      yield {
        data: output.data,
        sampleRateHz: output.sampleRateHz,
        isFinal: false
      }
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      providerId: this.id,
      message: 'Edge TTS provider ready'
    }
  }
}
