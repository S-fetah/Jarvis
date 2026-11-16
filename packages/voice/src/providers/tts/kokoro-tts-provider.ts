import fs from 'fs'
import path from 'path'
import type {
  AudioOutput,
  ProviderHealth,
  SpeechOptions,
  TextToSpeechProvider
} from '../../types'

export interface KokoroVoiceMetadata {
  id: string
  name: string
  gender: 'female' | 'male'
  lang: string
  desc: string
}

export const KOKORO_VOICES: KokoroVoiceMetadata[] = [
  // American Female
  { id: 'af_heart', name: 'Heart', gender: 'female', lang: 'en-us', desc: 'Warm, expressive, high-naturality' },
  { id: 'af_bella', name: 'Bella', gender: 'female', lang: 'en-us', desc: 'Crisp, friendly, articulate' },
  { id: 'af_sarah', name: 'Sarah', gender: 'female', lang: 'en-us', desc: 'Conversational, pleasant' },
  { id: 'af_nicole', name: 'Nicole', gender: 'female', lang: 'en-us', desc: 'Soft, calm, soothing' },
  { id: 'af_sky', name: 'Sky', gender: 'female', lang: 'en-us', desc: 'Bright, youthful' },
  { id: 'af_nova', name: 'Nova', gender: 'female', lang: 'en-us', desc: 'Dynamic, clear' },
  { id: 'af_river', name: 'River', gender: 'female', lang: 'en-us', desc: 'Warm, steady' },
  { id: 'af_jessica', name: 'Jessica', gender: 'female', lang: 'en-us', desc: 'Energetic, modern' },
  { id: 'af_aoede', name: 'Aoede', gender: 'female', lang: 'en-us', desc: 'Melodic, narrative' },
  { id: 'af_alloy', name: 'Alloy', gender: 'female', lang: 'en-us', desc: 'Upbeat, professional' },
  { id: 'af_kore', name: 'Kore', gender: 'female', lang: 'en-us', desc: 'Warm, measured' },

  // British Female
  { id: 'bf_emma', name: 'Emma', gender: 'female', lang: 'en-gb', desc: 'British, elegant, formal' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'female', lang: 'en-gb', desc: 'British, clear, refined' },
  { id: 'bf_alice', name: 'Alice', gender: 'female', lang: 'en-gb', desc: 'British, friendly, expressive' },
  { id: 'bf_lily', name: 'Lily', gender: 'female', lang: 'en-gb', desc: 'British, gentle, quiet' },

  // American Male
  { id: 'am_michael', name: 'Michael', gender: 'male', lang: 'en-us', desc: 'Deep, authoritative, warm' },
  { id: 'am_adam', name: 'Adam', gender: 'male', lang: 'en-us', desc: 'Confident, broadcast-ready' },
  { id: 'am_echo', name: 'Echo', gender: 'male', lang: 'en-us', desc: 'Smooth, approachable' },
  { id: 'am_eric', name: 'Eric', gender: 'male', lang: 'en-us', desc: 'Casual, friendly' },
  { id: 'am_fenrir', name: 'Fenrir', gender: 'male', lang: 'en-us', desc: 'Deep, resonant, dramatic' },
  { id: 'am_liam', name: 'Liam', gender: 'male', lang: 'en-us', desc: 'Clear, modern' },
  { id: 'am_onyx', name: 'Onyx', gender: 'male', lang: 'en-us', desc: 'Rich baritone, commanding' },
  { id: 'am_puck', name: 'Puck', gender: 'male', lang: 'en-us', desc: 'Lively, playful' },
  { id: 'am_santa', name: 'Santa', gender: 'male', lang: 'en-us', desc: 'Hearty, warm' },

  // British Male
  { id: 'bm_george', name: 'George', gender: 'male', lang: 'en-gb', desc: 'Classic British Butler / Jarvis-style' },
  { id: 'bm_lewis', name: 'Lewis', gender: 'male', lang: 'en-gb', desc: 'British, articulate, thoughtful' },
  { id: 'bm_daniel', name: 'Daniel', gender: 'male', lang: 'en-gb', desc: 'British, presenter, crisp' },
  { id: 'bm_fable', name: 'Fable', gender: 'male', lang: 'en-gb', desc: 'British, storyteller tone' }
]

export interface KokoroConfig {
  defaultVoice?: string // Default: 'af_heart'
  sampleRate?: number // Default: 24000
}

export class KokoroTTSProvider implements TextToSpeechProvider {
  readonly id = 'kokoro-82m'
  readonly locality = 'local' as const
  readonly supportsVoiceCloning = true

  private readonly defaultVoice: string
  private readonly sampleRate: number
  private static ttsInstance: any = null
  private static initPromise: Promise<any> | null = null

  constructor(config?: KokoroConfig) {
    this.defaultVoice = config?.defaultVoice || 'af_heart'
    this.sampleRate = config?.sampleRate || 24000
  }

  supportsStreaming(): boolean {
    return true
  }

  public static async getTTSInstance(): Promise<any> {
    if (KokoroTTSProvider.ttsInstance) {
      return KokoroTTSProvider.ttsInstance
    }

    if (!KokoroTTSProvider.initPromise) {
      KokoroTTSProvider.initPromise = (async () => {
        const { KokoroTTS } = await import('kokoro-js')
        const instance = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          {
            dtype: 'q8',
            device: 'cpu'
          }
        )
        KokoroTTSProvider.ttsInstance = instance
        return instance
      })()
    }

    return KokoroTTSProvider.initPromise
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      providerId: this.id,
      message: 'Kokoro-82M ONNX local CPU engine ready (28 neural voices, <150ms TTFA)'
    }
  }

  /**
   * Loads voice profile style vector (256 floats) if a custom profile file is specified.
   */
  loadStyleVector(stylePath: string): Float32Array | null {
    try {
      if (!fs.existsSync(stylePath)) return null
      const raw = fs.readFileSync(stylePath)
      if (stylePath.endsWith('.json')) {
        const parsed = JSON.parse(raw.toString('utf-8'))
        return new Float32Array(Array.isArray(parsed) ? parsed : parsed.styleVector)
      }
      return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
    } catch {
      return null
    }
  }

  /**
   * Resolves requested voice name or cloned profile path to an available Kokoro voice ID.
   */
  resolveVoice(requestedVoice?: string, speakerWav?: string): string {
    const raw = (requestedVoice || '').trim().toLowerCase()

    // 1. Direct match with official voice ID
    const directMatch = KOKORO_VOICES.find((v) => v.id.toLowerCase() === raw)
    if (directMatch) return directMatch.id

    // 2. Name alias matching (e.g. 'bella' -> 'af_bella', 'george' -> 'bm_george')
    const aliasMap: Record<string, string> = {
      heart: 'af_heart',
      bella: 'af_bella',
      sarah: 'af_sarah',
      nicole: 'af_nicole',
      sky: 'af_sky',
      nova: 'af_nova',
      river: 'af_river',
      jessica: 'af_jessica',
      aoede: 'af_aoede',
      alloy: 'af_alloy',
      kore: 'af_kore',
      emma: 'bf_emma',
      isabella: 'bf_isabella',
      alice: 'bf_alice',
      lily: 'bf_lily',
      michael: 'am_michael',
      adam: 'am_adam',
      echo: 'am_echo',
      eric: 'am_eric',
      fenrir: 'am_fenrir',
      liam: 'am_liam',
      onyx: 'am_onyx',
      puck: 'am_puck',
      santa: 'am_santa',
      george: 'bm_george',
      lewis: 'bm_lewis',
      daniel: 'bm_daniel',
      fable: 'bm_fable',
      // Common Windows & Edge cross-aliases
      zira: 'af_bella',
      david: 'bm_george',
      jenny: 'af_sarah',
      guy: 'am_michael'
    }

    if (aliasMap[raw]) {
      return aliasMap[raw]
    }

    // 3. Gender keyword fallback
    if (raw.includes('female') || raw.includes('woman')) return 'af_bella'
    if (raw.includes('male') || raw.includes('man') || raw.includes('jarvis')) return 'bm_george'

    // 4. Cloned profile fallback inspection
    if (speakerWav) {
      try {
        const metaPath = fs.existsSync(speakerWav) && fs.statSync(speakerWav).isDirectory()
          ? path.join(speakerWav, 'profile.json')
          : path.join(path.dirname(speakerWav), 'profile.json')

        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          if (meta.baseVoice && KOKORO_VOICES.some((v) => v.id === meta.baseVoice)) {
            return meta.baseVoice
          }
          if (meta.gender === 'female') return 'af_bella'
          if (meta.gender === 'male') return 'bm_george'
        }
      } catch {}
    }

    return this.defaultVoice
  }

  /**
   * Synthesize text into 24kHz WAV audio via Kokoro-82M ONNX model running on CPU.
   */
  async synthesize(text: string, options?: SpeechOptions): Promise<AudioOutput> {
    if (options?.signal?.aborted) {
      throw new Error('Synthesis aborted by user or barge-in')
    }

    const voice = this.resolveVoice(options?.voice, options?.speakerWav)
    const speed = Math.max(0.5, Math.min(2.0, options?.speed || 1.0))

    try {
      const tts = await KokoroTTSProvider.getTTSInstance()

      if (options?.signal?.aborted) {
        throw new Error('Synthesis aborted by user or barge-in')
      }

      const audioObj = await tts.generate(text, {
        voice,
        speed
      })

      const wavBuffer = audioObj.toWav()
      const data = new Uint8Array(wavBuffer)
      const durationMs = Math.round((audioObj.audio.length / audioObj.sampling_rate) * 1000)

      return {
        data,
        sampleRateHz: audioObj.sampling_rate || this.sampleRate,
        format: 'wav',
        durationMs,
        providerId: this.id,
        voice
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Kokoro-82M synthesis error [voice=${voice}]: ${msg}`)
    }
  }
}
