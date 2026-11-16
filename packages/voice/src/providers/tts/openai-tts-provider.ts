import type {
  AudioChunk,
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'

export interface OpenAITTSConfig {
  apiKey: string | (() => string | Promise<string>)
  model?: string // Default: tts-1
  voice?: string // Default: alloy (alloy, echo, fable, onyx, nova, shimmer)
  endpoint?: string // Default: https://api.openai.com/v1/audio/speech
}

export class OpenAITTSProvider implements TextToSpeechProvider {
  readonly id = 'openai-tts'
  readonly locality = 'cloud' as const

  private readonly apiKeyResolver: () => string | Promise<string>
  private readonly model: string
  private readonly defaultVoice: string
  private readonly endpoint: string

  constructor(config: OpenAITTSConfig) {
    if (typeof config.apiKey === 'function') {
      this.apiKeyResolver = config.apiKey
    } else {
      const key = config.apiKey
      this.apiKeyResolver = () => key
    }
    this.model = config.model || 'tts-1'
    this.defaultVoice = config.voice || 'alloy'
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/audio/speech'
  }

  supportsStreaming(): boolean {
    return true
  }

  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    const startTime = Date.now()
    const apiKey = await this.apiKeyResolver()
    if (!apiKey) {
      throw new Error('API key not configured for OpenAI TTS.')
    }

    const voice = options?.voice || this.defaultVoice
    const speed = options?.speed ?? 1.0

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        voice,
        speed,
        response_format: 'mp3'
      }),
      signal: options?.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`OpenAI TTS synthesis failed [${response.status}]: ${errText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    return {
      data,
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
    const startTime = Date.now()
    try {
      const apiKey = await this.apiKeyResolver()
      if (!apiKey) {
        return {
          ok: false,
          providerId: this.id,
          message: 'API key is missing'
        }
      }
      return {
        ok: true,
        providerId: this.id,
        latencyMs: Date.now() - startTime
      }
    } catch (err: unknown) {
      return {
        ok: false,
        providerId: this.id,
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }
}
