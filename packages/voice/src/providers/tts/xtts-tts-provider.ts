import path from 'path'
import fs from 'fs'
import type {
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'

export interface XTTSConfig {
  endpointUrl?: string // Default: 'http://127.0.0.1:8000'
  sampleRate?: number // Default: 24000
  streamChunkSize?: number // Default: 20 tokens
  defaultLanguage?: string // Default: 'en'
}

export class XTTSv2Provider implements TextToSpeechProvider {
  readonly id = 'xtts-v2'
  readonly locality = 'local' as const
  readonly supportsVoiceCloning = true

  private readonly endpointUrl: string
  private readonly sampleRate: number
  private readonly defaultLanguage: string

  constructor(config?: XTTSConfig) {
    this.endpointUrl = config?.endpointUrl || 'http://127.0.0.1:8000'
    this.sampleRate = config?.sampleRate || 24000
    this.defaultLanguage = config?.defaultLanguage || 'en'
  }

  supportsStreaming(): boolean {
    return true
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const res = await fetch(`${this.endpointUrl}/health`, {
        signal: AbortSignal.timeout(1000)
      })
      if (res.ok) {
        return {
          ok: true,
          providerId: this.id,
          message: `XTTS-v2 server active at ${this.endpointUrl}`
        }
      }
    } catch {
      // Server not reachable
    }

    return {
      ok: false,
      providerId: this.id,
      message: `XTTS-v2 server offline at ${this.endpointUrl}. Ensure the XTTS engine is running.`
    }
  }

  /**
   * Synthesize text into high-fidelity cloned speech using XTTS-v2.
   * If speaker profile contains precomputed latents, sends latents to skip reference audio encoder.
   */
  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    if (options?.signal?.aborted) {
      throw new Error('Synthesis aborted by user or barge-in')
    }

    const speakerProfile = options?.speakerWav ? this.resolveSpeakerProfile(options.speakerWav) : null

    try {
      const response = await fetch(`${this.endpointUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: options?.language || this.defaultLanguage,
          speed: options?.speed || 1.0,
          speaker_latents_path: speakerProfile?.latentsPath,
          speaker_wav_path: speakerProfile?.wavPath
        }),
        signal: options?.signal
      })

      if (!response.ok) {
        throw new Error(`XTTS-v2 synthesis failed with HTTP ${response.status}`)
      }

      const audioBuffer = await response.arrayBuffer()
      return {
        data: new Uint8Array(audioBuffer),
        sampleRateHz: this.sampleRate,
        format: 'wav'
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`XTTS-v2 local engine unreachable or failed: ${msg}`)
    }
  }

  /**
   * Resolves a voice profile path to identify precomputed latents or reference WAV audio.
   */
  resolveSpeakerProfile(profilePath: string): { latentsPath?: string; wavPath?: string } {
    if (!fs.existsSync(profilePath)) {
      return { wavPath: profilePath }
    }

    const stat = fs.statSync(profilePath)
    if (stat.isDirectory()) {
      const binPath = path.join(profilePath, 'xtts_speaker.bin')
      const wavPath = path.join(profilePath, 'reference.wav')
      return {
        latentsPath: fs.existsSync(binPath) ? binPath : undefined,
        wavPath: fs.existsSync(wavPath) ? wavPath : undefined
      }
    }

    if (profilePath.endsWith('.bin') || profilePath.endsWith('.pth')) {
      return { latentsPath: profilePath }
    }

    return { wavPath: profilePath }
  }
}
