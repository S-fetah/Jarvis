import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  AudioCacheManager,
  VoiceManager,
  type AudioOutput,
  type TextToSpeechProvider
} from '../packages/voice/src'

describe('AudioCacheManager (Temporary Session Audio Cache)', () => {
  let testCacheDir: string
  let cacheManager: AudioCacheManager

  beforeEach(() => {
    testCacheDir = path.join(os.tmpdir(), `jarvis-test-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    cacheManager = new AudioCacheManager({ cacheDir: testCacheDir })
  })

  afterEach(() => {
    try {
      if (fs.existsSync(testCacheDir)) {
        fs.rmSync(testCacheDir, { recursive: true, force: true })
      }
    } catch {}
  })

  it('computes deterministic SHA-256 keys', () => {
    const key1 = cacheManager.computeKey('Good evening, sir.', {
      voice: 'profile:javis-original',
      providerId: 'openvoice-v2',
      speed: 0.95
    })
    const key2 = cacheManager.computeKey('Good evening, sir. ', {
      voice: 'profile:javis-original',
      providerId: 'openvoice-v2',
      speed: 0.95
    })
    const keyDiffVoice = cacheManager.computeKey('Good evening, sir.', {
      voice: 'bm_george',
      providerId: 'openvoice-v2',
      speed: 0.95
    })

    expect(key1).toBe(key2)
    expect(key1).not.toBe(keyDiffVoice)
    expect(key1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('stores and retrieves cached audio output', async () => {
    const text = 'Testing session cache synthesis.'
    const options = { voice: 'profile:javis-original', speed: 1.0, providerId: 'openvoice-v2' }

    expect(await cacheManager.get(text, options)).toBeNull()
    expect(cacheManager.has(text, options)).toBe(false)

    const dummyOutput: AudioOutput = {
      data: new Uint8Array([1, 2, 3, 4, 5]),
      sampleRateHz: 24000,
      format: 'wav',
      durationMs: 800,
      providerId: 'openvoice-v2',
      voice: 'profile:javis-original'
    }

    await cacheManager.set(text, options, dummyOutput)

    expect(cacheManager.has(text, options)).toBe(true)
    const cached = await cacheManager.get(text, options)

    expect(cached).not.toBeNull()
    expect(cached?.cached).toBe(true)
    expect(cached?.sampleRateHz).toBe(24000)
    expect(cached?.format).toBe('wav')
    expect(cached?.durationMs).toBe(800)
    expect(cached?.providerId).toBe('openvoice-v2')
    expect(cached?.voice).toBe('profile:javis-original')
    expect(Array.from(cached!.data)).toEqual([1, 2, 3, 4, 5])
  })

  it('tracks disk stats and clears cache on demand', async () => {
    const dummyOutput: AudioOutput = {
      data: new Uint8Array(1024), // 1KB
      sampleRateHz: 24000,
      format: 'wav'
    }

    await cacheManager.set('First sentence', { voice: 'v1' }, dummyOutput)
    await cacheManager.set('Second sentence', { voice: 'v2' }, dummyOutput)

    const stats = cacheManager.getStats()
    expect(stats.entryCount).toBe(2)
    expect(stats.totalBytes).toBeGreaterThanOrEqual(2048)

    const cleared = cacheManager.clear()
    expect(cleared.clearedCount).toBeGreaterThanOrEqual(4) // 2 .bin + 2 .meta.json

    const afterStats = cacheManager.getStats()
    expect(afterStats.entryCount).toBe(0)
    expect(afterStats.totalBytes).toBe(0)
  })

  it('gracefully handles corrupted cache files without throwing', async () => {
    const text = 'Corrupted file test'
    const options = { voice: 'v1' }

    const key = cacheManager.computeKey(text, options)
    const metaPath = path.join(testCacheDir, `${key}.meta.json`)
    const binPath = path.join(testCacheDir, `${key}.bin`)

    // Write invalid JSON
    await fs.promises.writeFile(metaPath, 'NOT_VALID_JSON', 'utf8')
    await fs.promises.writeFile(binPath, Buffer.from([1, 2]))

    const result = await cacheManager.get(text, options)
    expect(result).toBeNull()
  })

  it('integrates seamlessly with VoiceManager.synthesize', async () => {
    const mockSynthesize = vi.fn().mockResolvedValue({
      data: new Uint8Array([42, 43, 44]),
      sampleRateHz: 24000,
      format: 'wav',
      durationMs: 500
    } satisfies AudioOutput)

    const mockProvider: TextToSpeechProvider = {
      id: 'mock-tts',
      locality: 'local',
      supportsStreaming: () => false,
      synthesize: mockSynthesize,
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'mock-tts' })
    }

    const manager = new VoiceManager({
      config: { ttsProvider: 'mock-tts' },
      ttsProviders: [mockProvider],
      audioCache: cacheManager
    })

    const text = 'All systems operating at 100 percent.'
    const opts = { voice: 'profile:javis-original' }

    // First call: Cache miss -> calls provider synthesize
    const res1 = await manager.synthesize(text, opts)
    expect(mockSynthesize).toHaveBeenCalledTimes(1)
    expect(res1.cached).toBeUndefined()
    expect(Array.from(res1.data)).toEqual([42, 43, 44])

    // Second call: Cache hit -> serves directly from cache without calling provider synthesize!
    const res2 = await manager.synthesize(text, opts)
    expect(mockSynthesize).toHaveBeenCalledTimes(1) // Still 1! Zero redundant TTS computation
    expect(res2.cached).toBe(true)
    expect(Array.from(res2.data)).toEqual([42, 43, 44])

    // Third call with bypassCache: true -> forces fresh synthesis
    const res3 = await manager.synthesize(text, { ...opts, bypassCache: true })
    expect(mockSynthesize).toHaveBeenCalledTimes(2)
    expect(res3.cached).toBeUndefined()

    // Test clearAudioCache from manager
    const clearResult = manager.clearAudioCache()
    expect(clearResult.clearedCount).toBeGreaterThan(0)
    expect(manager.getAudioCache()?.getStats().entryCount).toBe(0)
  })
})
