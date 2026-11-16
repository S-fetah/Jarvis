import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  SentenceChunker,
  TTSDispatcher,
  KokoroTTSProvider,
  XTTSv2Provider,
  VoiceProfileManager,
  type TextToSpeechProvider,
  type AudioOutput
} from '../packages/voice/src'

describe('SentenceChunker', () => {
  it('splits text on sentence punctuation (. ! ?) and preserves clean sentences', () => {
    const chunker = new SentenceChunker({ minChunkLength: 10 })
    const results = chunker.push(
      'Good morning, sir. All core diagnostics are operating within expected parameters! Would you like to review the flight plan?'
    )

    expect(results).toHaveLength(3)
    expect(results[0]).toBe('Good morning, sir.')
    expect(results[1]).toBe('All core diagnostics are operating within expected parameters!')
    expect(results[2]).toBe('Would you like to review the flight plan?')
    expect(chunker.flush()).toHaveLength(0)
  })

  it('protects abbreviations and decimal numbers from premature splitting', () => {
    const chunker = new SentenceChunker({ minChunkLength: 10 })
    const res1 = chunker.push('Dr. Watson confirmed the value is 3.14159. Please verify.')
    expect(res1).toHaveLength(2)
    expect(res1[0]).toBe('Dr. Watson confirmed the value is 3.14159.')
    expect(res1[1]).toBe('Please verify.')
  })

  it('breaks long clauses exceeding maxChunkLength on commas or semicolons', () => {
    const chunker = new SentenceChunker({ minChunkLength: 15, maxChunkLength: 60 })
    const longText = 'We have completed the security audit of all submodules, and all 8 checks passed without any critical vulnerabilities.'
    const chunks = chunker.push(longText)
    const flushed = chunker.flush()
    const all = [...chunks, ...flushed]

    expect(all.length).toBeGreaterThan(1)
    expect(all[0]).toContain('security audit')
  })

  it('streams async token chunks and yields complete sentences', async () => {
    const chunker = new SentenceChunker({ minChunkLength: 10 })
    async function* tokenStream() {
      yield 'Jarvis '
      yield 'is '
      yield 'online. '
      yield 'How can '
      yield 'I help you today?'
    }

    const sentences: string[] = []
    for await (const s of chunker.processStream(tokenStream())) {
      sentences.push(s)
    }

    expect(sentences).toEqual(['Jarvis is online.', 'How can I help you today?'])
  })
})

describe('TTSDispatcher', () => {
  it('cascades to fallback provider when primary fails', async () => {
    const primaryMock: TextToSpeechProvider = {
      id: 'failing-primary',
      locality: 'local',
      supportsStreaming: () => true,
      synthesize: vi.fn().mockRejectedValue(new Error('CUDA Out of Memory')),
      healthCheck: vi.fn().mockResolvedValue({ ok: false, providerId: 'failing-primary' })
    }

    const fallbackMock: TextToSpeechProvider = {
      id: 'working-fallback',
      locality: 'local',
      supportsStreaming: () => false,
      synthesize: vi.fn().mockResolvedValue({
        data: new Uint8Array([1, 2, 3, 4]),
        sampleRateHz: 24000,
        format: 'wav',
        durationMs: 300
      } satisfies AudioOutput),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'working-fallback' })
    }

    const dispatcher = new TTSDispatcher({
      providers: [primaryMock, fallbackMock],
      primaryId: 'failing-primary',
      fallbackId: 'working-fallback'
    })

    const result = await dispatcher.synthesize('Hello Jarvis.')
    expect(result.data).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(primaryMock.synthesize).toHaveBeenCalled()
    expect(fallbackMock.synthesize).toHaveBeenCalled()
  })

  it('halts stream synthesis immediately when AbortSignal fires', async () => {
    const controller = new AbortController()
    const provider: TextToSpeechProvider = {
      id: 'mock-provider',
      locality: 'local',
      supportsStreaming: () => true,
      synthesize: vi.fn().mockImplementation(async () => {
        controller.abort()
        return {
          data: new Uint8Array([10, 20]),
          sampleRateHz: 16000,
          format: 'wav'
        } satisfies AudioOutput
      }),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'mock-provider' })
    }

    const dispatcher = new TTSDispatcher({
      providers: [provider],
      primaryId: 'mock-provider'
    })

    async function* multiSentenceStream() {
      yield 'First sentence completed. '
      yield 'Second sentence should not be synthesized.'
    }

    const chunks = []
    for await (const chunk of dispatcher.synthesizeStream(multiSentenceStream(), {
      signal: controller.signal
    })) {
      chunks.push(chunk)
    }

    // After first sentence aborted, second sentence is not synthesized
    expect(chunks.length).toBe(1)
    expect(provider.synthesize).toHaveBeenCalledTimes(1)
  })
})

describe('KokoroTTSProvider', () => {
  it('reports health and resolves model existence gracefully', async () => {
    const provider = new KokoroTTSProvider()
    const health = await provider.healthCheck()
    expect(health.providerId).toBe('kokoro-82m')
    expect(typeof health.ok).toBe('boolean')
  })

  it('parses style vector from JSON or raw binary', () => {
    const provider = new KokoroTTSProvider()
    const tmpDir = path.join(os.tmpdir(), `kokoro-test-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    try {
      const jsonPath = path.join(tmpDir, 'style.json')
      const vector = Array.from({ length: 256 }, (_, i) => i * 0.01)
      fs.writeFileSync(jsonPath, JSON.stringify(vector))

      const loaded = provider.loadStyleVector(jsonPath)
      expect(loaded).not.toBeNull()
      expect(loaded?.length).toBe(256)
      expect(loaded?.[10]).toBeCloseTo(0.1, 2)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('XTTSv2Provider', () => {
  it('correctly resolves speaker profile directories and latents files', () => {
    const provider = new XTTSv2Provider()
    const tmpDir = path.join(os.tmpdir(), `xtts-profile-test-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    try {
      const binFile = path.join(tmpDir, 'xtts_speaker.bin')
      const wavFile = path.join(tmpDir, 'reference.wav')
      fs.writeFileSync(binFile, Buffer.from('latents'))
      fs.writeFileSync(wavFile, Buffer.from('audio'))

      // Folder resolution
      const resolved = provider.resolveSpeakerProfile(tmpDir)
      expect(resolved.latentsPath).toBe(binFile)
      expect(resolved.wavPath).toBe(wavFile)

      // Direct file resolution
      const directResolved = provider.resolveSpeakerProfile(binFile)
      expect(directResolved.latentsPath).toBe(binFile)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('VoiceProfileManager (Dual-Cached Zero-Shot Cloning)', () => {
  let testDir: string
  let manager: VoiceProfileManager

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `jarvis-voice-profiles-${Date.now()}`)
    manager = new VoiceProfileManager({ baseDir: testDir })
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('enrolls a voice profile and precomputes dual cached tensors (xtts_speaker.bin and kokoro_style.bin)', async () => {
    const dummyWav = new Uint8Array(4000).fill(128)
    const profile = await manager.createProfile(
      'Tony Stark',
      dummyWav,
      'High confidence metallic assistant profile'
    )

    expect(profile.id).toBe('tony-stark')
    expect(profile.name).toBe('Tony Stark')
    expect(profile.hasXttsLatents).toBe(true)
    expect(profile.hasKokoroStyle).toBe(true)

    // Verify files on disk
    expect(fs.existsSync(path.join(profile.folderPath, 'reference.wav'))).toBe(true)
    expect(fs.existsSync(path.join(profile.folderPath, 'xtts_speaker.bin'))).toBe(true)
    expect(fs.existsSync(path.join(profile.folderPath, 'kokoro_style.bin'))).toBe(true)
    expect(fs.existsSync(path.join(profile.folderPath, 'profile.json'))).toBe(true)

    // Verify kokoro style vector tensor size (256 * 4 bytes = 1024 bytes)
    const kokoroStats = fs.statSync(path.join(profile.folderPath, 'kokoro_style.bin'))
    expect(kokoroStats.size).toBe(1024)

    // Verify listing and retrieval
    const list = await manager.listProfiles()
    expect(list.length).toBe(1)
    expect(list[0].id).toBe('tony-stark')

    const retrieved = await manager.getProfile('tony-stark')
    expect(retrieved?.name).toBe('Tony Stark')

    // Verify deletion
    const deleted = await manager.deleteProfile('tony-stark')
    expect(deleted).toBe(true)
    expect(await manager.listProfiles()).toHaveLength(0)
  })
})
