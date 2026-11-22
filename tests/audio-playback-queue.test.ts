import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AudioPlaybackService,
  splitSentencesForSpeech
} from '../apps/desktop/src/renderer/src/lib/audio-service'

describe('AudioPlaybackService & Streaming Audio Queue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with idle state and empty queue', () => {
    const service = new AudioPlaybackService()
    expect(service.isPlaying()).toBe(false)
    expect(service.getQueueLength()).toBe(0)
  })

  it('notifies state listeners when playback state changes', () => {
    const service = new AudioPlaybackService()
    const listener = vi.fn()
    const unsubscribe = service.onStateChange(listener)

    ;(service as any).setPlaying(true)
    expect(listener).toHaveBeenCalledWith(true)

    ;(service as any).setPlaying(false)
    expect(listener).toHaveBeenCalledWith(false)

    unsubscribe()
    ;(service as any).setPlaying(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops and flushes queue when stop() is called', () => {
    const service = new AudioPlaybackService()
    ;(service as any).playbackQueue = [
      { audioBytes: new Uint8Array([1]), sampleRate: 24000, resolve: vi.fn(), reject: vi.fn() },
      { audioBytes: new Uint8Array([2]), sampleRate: 24000, resolve: vi.fn(), reject: vi.fn() }
    ]
    ;(service as any).isCurrentlyPlaying = true

    service.stop()

    expect(service.isPlaying()).toBe(false)
    expect(service.getQueueLength()).toBe(0)
  })
})

describe('Renderer splitSentencesForSpeech', () => {
  it('splits long markdown responses into coherent sentences for streaming', () => {
    const reply =
      'Good evening, sir. All automated systems are functioning within normal operational parameters! ' +
      'I have scanned the active workspace and discovered 3 items, e.g. tests and linting. Shall I proceed?'
    const sentences = splitSentencesForSpeech(reply)

    expect(sentences.length).toBe(4)
    expect(sentences[0]).toBe('Good evening, sir.')
    expect(sentences[1]).toBe(
      'All automated systems are functioning within normal operational parameters!'
    )
    expect(sentences[2]).toContain('e.g. tests and linting.')
    expect(sentences[3]).toBe('Shall I proceed?')
  })

  it('strips emojis and markdown bullet formatting', () => {
    const raw = `Certainly, sir! 🚀 Here are the results:\n* Item 1: Database synchronized\n* Item 2: Cache warmed up\nAll done!`
    const sentences = splitSentencesForSpeech(raw)

    expect(sentences.length).toBeGreaterThanOrEqual(1)
    expect(sentences[0]).toBe('Certainly, sir!')
    for (const s of sentences) {
      expect(s).not.toContain('🚀')
      expect(s).not.toContain('*')
    }
  })
})
