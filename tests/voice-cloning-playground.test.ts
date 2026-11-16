import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  KokoroTTSProvider,
  SystemSpeechTTSProvider,
  VoiceProfileManager,
  VoiceManager,
  type TextToSpeechProvider
} from '../packages/voice/src'

describe('Voice Selection, Kokoro-82M & Voice Profile Architecture', () => {
  let testProfilesDir: string

  beforeEach(() => {
    testProfilesDir = path.join(os.tmpdir(), `jarvis-test-profiles-${Date.now()}`)
    fs.mkdirSync(testProfilesDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(testProfilesDir)) {
      fs.rmSync(testProfilesDir, { recursive: true, force: true })
    }
  })

  describe('KokoroTTSProvider Voice Resolution', () => {
    const provider = new KokoroTTSProvider()

    it('resolves direct Kokoro female voice IDs and aliases', () => {
      expect(provider.resolveVoice('af_heart')).toBe('af_heart')
      expect(provider.resolveVoice('af_bella')).toBe('af_bella')
      expect(provider.resolveVoice('bella')).toBe('af_bella')
      expect(provider.resolveVoice('heart')).toBe('af_heart')
      expect(provider.resolveVoice('sarah')).toBe('af_sarah')
      expect(provider.resolveVoice('nicole')).toBe('af_nicole')
      expect(provider.resolveVoice('emma')).toBe('bf_emma')
      expect(provider.resolveVoice('female')).toBe('af_bella')
    })

    it('resolves direct Kokoro male voice IDs and aliases', () => {
      expect(provider.resolveVoice('bm_george')).toBe('bm_george')
      expect(provider.resolveVoice('george')).toBe('bm_george')
      expect(provider.resolveVoice('am_michael')).toBe('am_michael')
      expect(provider.resolveVoice('michael')).toBe('am_michael')
      expect(provider.resolveVoice('adam')).toBe('am_adam')
      expect(provider.resolveVoice('lewis')).toBe('bm_lewis')
      expect(provider.resolveVoice('male')).toBe('bm_george')
      expect(provider.resolveVoice('jarvis')).toBe('bm_george')
    })

    it('resolves voice from cloned profile metadata', () => {
      const profDir = path.join(testProfilesDir, 'custom-heroine')
      fs.mkdirSync(profDir, { recursive: true })
      fs.writeFileSync(
        path.join(profDir, 'profile.json'),
        JSON.stringify({
          id: 'custom-heroine',
          name: 'Heroine',
          gender: 'female',
          baseVoice: 'af_bella'
        })
      )

      const resolved = provider.resolveVoice(undefined, profDir)
      expect(resolved).toBe('af_bella')
    })
  })

  describe('SystemSpeechTTSProvider Gender Preservation', () => {
    const provider = new SystemSpeechTTSProvider()

    it('maps female voice requests to Microsoft Zira Desktop', () => {
      const resolvedBella = (provider as any).resolveVoice('af_bella')
      expect(resolvedBella.voiceName).toBe('Microsoft Zira Desktop')
      expect(resolvedBella.isFemale).toBe(true)

      const resolvedHeart = (provider as any).resolveVoice('af_heart')
      expect(resolvedHeart.voiceName).toBe('Microsoft Zira Desktop')
      expect(resolvedHeart.isFemale).toBe(true)

      const resolvedFemale = (provider as any).resolveVoice('female')
      expect(resolvedFemale.voiceName).toBe('Microsoft Zira Desktop')
      expect(resolvedFemale.isFemale).toBe(true)
    })

    it('maps male voice requests to Microsoft David Desktop', () => {
      const resolvedGeorge = (provider as any).resolveVoice('bm_george')
      expect(resolvedGeorge.voiceName).toBe('Microsoft David Desktop')
      expect(resolvedGeorge.isFemale).toBe(false)

      const resolvedMichael = (provider as any).resolveVoice('am_michael')
      expect(resolvedMichael.voiceName).toBe('Microsoft David Desktop')
      expect(resolvedMichael.isFemale).toBe(false)

      const resolvedDavid = (provider as any).resolveVoice('Microsoft David Desktop')
      expect(resolvedDavid.voiceName).toBe('Microsoft David Desktop')
      expect(resolvedDavid.isFemale).toBe(false)
    })

    it('maps cloned female profile to Microsoft Zira Desktop on fallback', () => {
      const profDir = path.join(testProfilesDir, 'female-profile')
      fs.mkdirSync(profDir, { recursive: true })
      fs.writeFileSync(
        path.join(profDir, 'profile.json'),
        JSON.stringify({
          id: 'female-profile',
          gender: 'female',
          baseVoice: 'af_bella'
        })
      )

      const resolved = (provider as any).resolveVoice(undefined, profDir)
      expect(resolved.voiceName).toBe('Microsoft Zira Desktop')
      expect(resolved.isFemale).toBe(true)
    })
  })

  describe('VoiceProfileManager Gender & Persona Enrollment', () => {
    it('detects female persona and assigns af_bella as companion base voice', async () => {
      const manager = new VoiceProfileManager({ baseDir: testProfilesDir })
      const dummyWav = new Uint8Array(1000).fill(128)

      const profile = await manager.createProfile('Sarah Connor', dummyWav, 'Female resistance fighter')
      expect(profile.gender).toBe('female')
      expect(profile.baseVoice).toBe('af_bella')

      const savedMeta = JSON.parse(
        fs.readFileSync(path.join(profile.folderPath, 'profile.json'), 'utf-8')
      )
      expect(savedMeta.gender).toBe('female')
      expect(savedMeta.baseVoice).toBe('af_bella')
    })

    it('detects male persona and assigns bm_george as companion base voice', async () => {
      const manager = new VoiceProfileManager({ baseDir: testProfilesDir })
      const dummyWav = new Uint8Array(1000).fill(128)

      const profile = await manager.createProfile('Jarvis Assistant', dummyWav, 'Male British AI butler')
      expect(profile.gender).toBe('male')
      expect(profile.baseVoice).toBe('bm_george')
    })

    it('honors explicitly specified gender and companion base voice', async () => {
      const manager = new VoiceProfileManager({ baseDir: testProfilesDir })
      const dummyWav = new Uint8Array(1000).fill(128)

      const profile = await manager.createProfile('Custom Agent', dummyWav, 'Agent description', {
        gender: 'female',
        baseVoice: 'bf_emma'
      })
      expect(profile.gender).toBe('female')
      expect(profile.baseVoice).toBe('bf_emma')
    })
  })

  describe('VoiceManager Intelligent Engine Auto-Routing', () => {
    it('routes to kokoro-82m when Kokoro voice is requested in auto mode', () => {
      const kokoroMock: TextToSpeechProvider = {
        id: 'kokoro-82m',
        locality: 'local',
        supportsStreaming: () => true,
        synthesize: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'kokoro-82m' })
      }

      const sysMock: TextToSpeechProvider = {
        id: 'system-speech',
        locality: 'local',
        supportsStreaming: () => false,
        synthesize: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'system-speech' })
      }

      const manager = new VoiceManager({
        config: { ttsProvider: 'auto' },
        ttsProviders: [kokoroMock, sysMock]
      })

      const resolved = manager.resolveTTSProvider({ voice: 'af_bella', providerId: 'auto' })
      expect(resolved?.id).toBe('kokoro-82m')

      const resolvedMale = manager.resolveTTSProvider({ voice: 'bm_george', providerId: 'auto' })
      expect(resolvedMale?.id).toBe('kokoro-82m')
    })

    it('routes cloned profile to XTTS-v2 if registered, or falls back to Kokoro-82M', () => {
      const kokoroMock: TextToSpeechProvider = {
        id: 'kokoro-82m',
        locality: 'local',
        supportsStreaming: () => true,
        synthesize: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'kokoro-82m' })
      }

      const manager = new VoiceManager({
        config: { ttsProvider: 'auto' },
        ttsProviders: [kokoroMock]
      })

      const resolved = manager.resolveTTSProvider({ speakerWav: 'C:/fake/profile', providerId: 'auto' })
      expect(resolved?.id).toBe('kokoro-82m')
    })

    it('preserves providerId and voice in synthesis output', async () => {
      const kokoroMock: TextToSpeechProvider = {
        id: 'kokoro-82m',
        locality: 'local',
        supportsStreaming: () => true,
        synthesize: vi.fn().mockResolvedValue({
          data: new Uint8Array([1, 2, 3]),
          sampleRateHz: 24000,
          format: 'wav',
          durationMs: 400,
          providerId: 'kokoro-82m',
          voice: 'af_bella'
        }),
        healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'kokoro-82m' })
      }

      const manager = new VoiceManager({
        config: { ttsProvider: 'auto' },
        ttsProviders: [kokoroMock]
      })

      const out = await manager.synthesize('Test speech', { voice: 'af_bella' })
      expect(out.providerId).toBe('kokoro-82m')
      expect(out.voice).toBe('af_bella')
      expect(out.format).toBe('wav')
      expect(out.sampleRateHz).toBe(24000)
    })

    it('routes to openvoice-v2 by default when configured with javis-original persona', async () => {
      const openVoiceMock: TextToSpeechProvider = {
        id: 'openvoice-v2',
        locality: 'local',
        supportsStreaming: () => false,
        synthesize: vi.fn().mockResolvedValue({
          data: new Uint8Array([10, 20, 30]),
          sampleRateHz: 24000,
          format: 'wav',
          durationMs: 1200,
          providerId: 'openvoice-v2',
          voice: 'bm_george'
        }),
        healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'openvoice-v2' })
      }

      const manager = new VoiceManager({
        config: {
          ttsProvider: 'openvoice-v2',
          ttsVoice: 'profile:javis-original',
          speed: 0.95
        },
        ttsProviders: [openVoiceMock]
      })

      // When options are empty, resolveTTSProvider uses the configured default
      const provider = manager.resolveTTSProvider({})
      expect(provider?.id).toBe('openvoice-v2')

      const cfg = manager.getConfig()
      expect(cfg.ttsProvider).toBe('openvoice-v2')
      expect(cfg.ttsVoice).toBe('profile:javis-original')
      expect(cfg.speed).toBe(0.95)

      const res = await manager.synthesize('Good evening, sir.')
      expect(res.providerId).toBe('openvoice-v2')
      expect(openVoiceMock.synthesize).toHaveBeenCalledWith(
        'Good evening, sir.',
        expect.objectContaining({ speed: 0.95 })
      )
    })
  })
})
