import type {
  AudioInput,
  ProviderHealth,
  SpeechToTextProvider,
  Transcript,
  TranscriptionOptions
} from '../../types'
import { pcm16ToWav } from '../../utils/audio-converter'

export interface GroqWhisperConfig {
  apiKey: string | (() => string | Promise<string>)
  model?: string // Default: whisper-large-v3-turbo
  endpoint?: string // Default: https://api.groq.com/openai/v1/audio/transcriptions
  temperature?: number
}

export class GroqWhisperSTTProvider implements SpeechToTextProvider {
  readonly id = 'groq-whisper'
  readonly locality = 'cloud' as const

  private readonly apiKeyResolver: () => string | Promise<string>
  private readonly model: string
  private readonly endpoint: string
  private readonly temperature: number

  constructor(config: GroqWhisperConfig) {
    if (typeof config.apiKey === 'function') {
      this.apiKeyResolver = config.apiKey
    } else {
      const key = config.apiKey
      this.apiKeyResolver = () => key
    }
    this.model = config.model || 'whisper-large-v3-turbo'
    this.endpoint = config.endpoint || 'https://api.groq.com/openai/v1/audio/transcriptions'
    this.temperature = config.temperature ?? 0.0
  }

  supportsStreaming(): boolean {
    return false
  }

  async transcribe(audio: AudioInput, options?: TranscriptionOptions): Promise<Transcript> {
    const startTime = Date.now()
    const apiKey = await this.apiKeyResolver()
    if (!apiKey) {
      throw new Error('Groq API key not configured for speech-to-text.')
    }

    // Prepare audio bytes as WAV or native buffer
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
    formData.append('response_format', 'verbose_json')
    formData.append('temperature', String(this.temperature ?? 0.0))

    const prompt = options?.prompt || 'Jarvis, system, code, assistant, conversational, terminal, prompt, workflow.'
    formData.append('prompt', prompt)

    const lang = options?.language || 'en'
    if (lang && lang !== 'auto') {
      formData.append('language', lang)
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
      throw new Error(`Groq Whisper STT failed [${response.status}]: ${errText}`)
    }

    const json = (await response.json()) as {
      text?: string
      language?: string
      duration?: number
    }

    const text = (json.text || '').trim()
    const latencyMs = Date.now() - startTime

    return {
      text,
      language: json.language,
      durationMs: json.duration ? Math.round(json.duration * 1000) : latencyMs
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
