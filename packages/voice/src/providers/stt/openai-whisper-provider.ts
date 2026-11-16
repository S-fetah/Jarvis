import type {
  AudioInput,
  ProviderHealth,
  SpeechToTextProvider,
  Transcript,
  TranscriptionOptions
} from '../../types'
import { pcm16ToWav } from '../../utils/audio-converter'

export interface OpenAIWhisperConfig {
  apiKey: string | (() => string | Promise<string>)
  model?: string // Default: whisper-1
  endpoint?: string // Default: https://api.openai.com/v1/audio/transcriptions
}

export class OpenAIWhisperSTTProvider implements SpeechToTextProvider {
  readonly id = 'openai-whisper'
  readonly locality = 'cloud' as const

  private readonly apiKeyResolver: () => string | Promise<string>
  private readonly model: string
  private readonly endpoint: string

  constructor(config: OpenAIWhisperConfig) {
    if (typeof config.apiKey === 'function') {
      this.apiKeyResolver = config.apiKey
    } else {
      const key = config.apiKey
      this.apiKeyResolver = () => key
    }
    this.model = config.model || 'whisper-1'
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/audio/transcriptions'
  }

  supportsStreaming(): boolean {
    return false
  }

  async transcribe(audio: AudioInput, options?: TranscriptionOptions): Promise<Transcript> {
    const startTime = Date.now()
    const apiKey = await this.apiKeyResolver()
    if (!apiKey) {
      throw new Error('OpenAI API key not configured for speech-to-text.')
    }

    let audioBytes = audio.data
    let filename = 'audio.wav'
    let mimeType = 'audio/wav'

    if (audio.format === 'pcm16') {
      audioBytes = pcm16ToWav(audio.data, audio.sampleRateHz, audio.channels)
    } else if (audio.format === 'webm') {
      filename = 'audio.webm'
      mimeType = 'audio/webm'
    } else if (audio.format === 'ogg') {
      filename = 'audio.ogg'
      mimeType = 'audio/ogg'
    }

    const formData = new FormData()
    const audioBlob = new Blob([audioBytes as unknown as BlobPart], { type: mimeType })
    formData.append('file', audioBlob, filename)
    formData.append('model', this.model)

    if (options?.language) {
      formData.append('language', options.language)
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData,
      signal: options?.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`OpenAI Whisper STT failed [${response.status}]: ${errText}`)
    }

    const json = (await response.json()) as { text?: string }
    const text = (json.text || '').trim()

    return {
      text,
      durationMs: Date.now() - startTime
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
