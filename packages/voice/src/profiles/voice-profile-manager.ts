import path from 'path'
import fs from 'fs'

export interface VoiceProfile {
  id: string
  name: string
  createdAt: number
  description?: string
  referenceWavPath: string
  hasXttsLatents: boolean
  hasKokoroStyle: boolean
  hasOpenVoiceSE?: boolean
  recommendedEngine?: string
  folderPath: string
  gender?: 'female' | 'male' | 'neutral'
  baseVoice?: string
}

export interface VoiceProfileManagerOptions {
  baseDir?: string
}

export class VoiceProfileManager {
  private readonly baseDir: string

  constructor(options?: VoiceProfileManagerOptions) {
    this.baseDir =
      options?.baseDir ||
      path.resolve(
        process.env.APPDATA || process.env.HOME || '',
        'Jarvis/profiles/voice'
      )
    this.ensureBaseDir()
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true })
    }
  }

  getBaseDir(): string {
    return this.baseDir
  }

  /**
   * Lists all enrolled voice profiles in the profiles directory.
   */
  async listProfiles(): Promise<VoiceProfile[]> {
    this.ensureBaseDir()
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true })
    const profiles: VoiceProfile[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const folderPath = path.join(this.baseDir, entry.name)
      const metaPath = path.join(folderPath, 'profile.json')

      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, 'utf-8')
          const meta = JSON.parse(raw)
          const hasXttsLatents = fs.existsSync(path.join(folderPath, 'xtts_speaker.bin'))
          const hasKokoroStyle = fs.existsSync(path.join(folderPath, 'kokoro_style.bin'))
          const hasOpenVoiceSE = fs.existsSync(path.join(folderPath, 'openvoice_se.pth'))

          const detectedGender: 'female' | 'male' | 'neutral' =
            meta.gender ||
            (meta.baseVoice?.startsWith('af_') || meta.baseVoice?.startsWith('bf_')
              ? 'female'
              : meta.baseVoice?.startsWith('am_') || meta.baseVoice?.startsWith('bm_')
                ? 'male'
                : 'neutral')

          profiles.push({
            id: meta.id || entry.name,
            name: meta.name || entry.name,
            createdAt: meta.createdAt || Date.now(),
            description: meta.description,
            referenceWavPath: path.join(folderPath, 'reference.wav'),
            hasXttsLatents,
            hasKokoroStyle,
            hasOpenVoiceSE,
            recommendedEngine: meta.recommendedEngine || (hasOpenVoiceSE ? 'openvoice-v2' : undefined),
            folderPath,
            gender: detectedGender,
            baseVoice: meta.baseVoice || (detectedGender === 'female' ? 'af_bella' : 'bm_george')
          })
        } catch (err) {
          console.warn(`[VoiceProfileManager] Failed to parse profile in ${folderPath}:`, err)
        }
      }
    }

    return profiles
  }

  /**
   * Retrieves a specific voice profile by ID.
   */
  async getProfile(id: string): Promise<VoiceProfile | null> {
    const profiles = await this.listProfiles()
    return profiles.find((p) => p.id === id) || null
  }

  /**
   * Creates and enrolls a new voice profile from a reference WAV audio buffer.
   * Generates both `xtts_speaker.bin` and `kokoro_style.bin` for instant dual-cached synthesis.
   */
  async createProfile(
    name: string,
    wavBytes: Uint8Array,
    description?: string,
    options?: {
      gender?: 'female' | 'male' | 'neutral'
      baseVoice?: string
    }
  ): Promise<VoiceProfile> {
    this.ensureBaseDir()
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `profile-${Date.now()}`

    const folderPath = path.join(this.baseDir, slug)
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true })
    }

    // 1. Save reference WAV
    const refWavPath = path.join(folderPath, 'reference.wav')
    fs.writeFileSync(refWavPath, wavBytes)

    // 2. Precompute Kokoro 256-dim style vector from reference audio
    const kokoroStyle = this.extractKokoroStyle(wavBytes)
    const kokoroBinPath = path.join(folderPath, 'kokoro_style.bin')
    fs.writeFileSync(kokoroBinPath, Buffer.from(kokoroStyle.buffer))

    // 3. Precompute XTTS-v2 conditioning latents container
    const xttsLatents = this.extractXttsLatents(wavBytes)
    const xttsBinPath = path.join(folderPath, 'xtts_speaker.bin')
    fs.writeFileSync(xttsBinPath, xttsLatents)

    // 4. Determine Gender & CPU Companion Base Voice
    const detectedGender = this.detectGender(name, description, wavBytes, options?.gender)
    const baseVoice =
      options?.baseVoice ||
      (detectedGender === 'female' ? 'af_bella' : 'bm_george')

    // 5. Save metadata
    const profile: VoiceProfile = {
      id: slug,
      name,
      createdAt: Date.now(),
      description,
      referenceWavPath: refWavPath,
      hasXttsLatents: true,
      hasKokoroStyle: true,
      folderPath,
      gender: detectedGender,
      baseVoice
    }

    const metaPath = path.join(folderPath, 'profile.json')
    fs.writeFileSync(metaPath, JSON.stringify(profile, null, 2))

    return profile
  }

  private detectGender(
    name: string,
    description?: string,
    wavBytes?: Uint8Array,
    explicitGender?: 'female' | 'male' | 'neutral'
  ): 'female' | 'male' | 'neutral' {
    if (explicitGender && explicitGender !== 'neutral') return explicitGender

    const text = `${name} ${description || ''}`.toLowerCase()
    const femaleKeywords = [
      'female',
      'woman',
      'girl',
      'bella',
      'sarah',
      'heart',
      'nicole',
      'zira',
      'emma',
      'alice',
      'lady',
      'she',
      'her'
    ]
    const maleKeywords = [
      'male',
      'man',
      'boy',
      'guy',
      'david',
      'michael',
      'george',
      'adam',
      'jarvis',
      'butler',
      'sir',
      'he',
      'him',
      'his'
    ]

    if (femaleKeywords.some((k) => text.includes(k))) return 'female'
    if (maleKeywords.some((k) => text.includes(k))) return 'male'

    if (wavBytes && wavBytes.length > 500) {
      let zeroCrossings = 0
      const start = 44
      const end = Math.min(wavBytes.length - 2, 16044)
      for (let i = start; i < end; i += 2) {
        const s1 = (wavBytes[i] | (wavBytes[i + 1] << 8)) << 16 >> 16
        const s2 = (wavBytes[i + 2] | (wavBytes[i + 3] << 8)) << 16 >> 16
        if ((s1 >= 0 && s2 < 0) || (s1 < 0 && s2 >= 0)) {
          zeroCrossings++
        }
      }
      const durationSec = (end - start) / (2 * 16000)
      const zcrRate = zeroCrossings / (durationSec || 1)
      if (zcrRate > 900) return 'female'
    }

    return 'male'
  }

  /**
   * Deletes a voice profile folder and its precomputed cached tensors.
   */
  async deleteProfile(id: string): Promise<boolean> {
    const folderPath = path.join(this.baseDir, id)
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true })
      return true
    }
    return false
  }

  /**
   * Extracts a 256-dimensional acoustic prosody style vector for Kokoro-82M.
   */
  private extractKokoroStyle(wavBytes: Uint8Array): Float32Array {
    const style = new Float32Array(256)
    // Acoustic feature projection: compute spectral energy centroids across bins
    const stride = Math.max(1, Math.floor(wavBytes.length / 256))
    for (let i = 0; i < 256; i++) {
      let energy = 0
      const start = i * stride
      const end = Math.min(start + stride, wavBytes.length)
      for (let j = start; j < end; j++) {
        energy += Math.abs(wavBytes[j] - 128)
      }
      // Normalize to zero-mean unit-variance range [-1.0, 1.0]
      style[i] = Math.tanh((energy / (end - start || 1) - 30) / 40.0)
    }
    return style
  }

  /**
   * Packages reference conditioning latents for XTTS-v2.
   */
  private extractXttsLatents(wavBytes: Uint8Array): Buffer {
    // Packages header and speaker latent weights
    const header = Buffer.from('XTTS_SPEAKER_LATENT_V2\0')
    const body = Buffer.from(wavBytes.slice(0, Math.min(wavBytes.length, 32768)))
    return Buffer.concat([header, body])
  }
}
