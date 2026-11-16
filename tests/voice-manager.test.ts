import { describe, it, expect, vi } from 'vitest'
import {
  VoiceManager,
  GroqWhisperSTTProvider,
  OpenAIWhisperSTTProvider,
  OpenAITTSProvider,
  type SpeechToTextProvider,
  type TextToSpeechProvider,
  type AudioInput,
  type Transcript,
  type AudioOutput
} from '../packages/voice/src'

describe('VoiceManager & Cloud Providers', () => {
  it('initializes with default config and state is idle', () => {
    const manager = new VoiceManager()
    expect(manager.getState()).toBe('idle')
    expect(manager.getConfig().sttProvider).toBe('groq-whisper')
    expect(manager.getConfig().ttsProvider).toBe('edge-tts')
    expect(manager.getConfig().ttsFallbackProvider).toBe('system-speech')
  })

  it('updates config and transitions states with event emission', () => {
    const manager = new VoiceManager()
    const events: string[] = []

    manager.on('stateChange', (newState, oldState) => {
      events.push(`${oldState}->${newState}`)
    })

    manager.setState('listening')
    expect(manager.getState()).toBe('listening')

    manager.setState('thinking')
    expect(manager.getState()).toBe('thinking')

    manager.interrupt()
    expect(manager.getState()).toBe('interrupted')

    expect(events).toEqual(['idle->listening', 'listening->thinking', 'thinking->interrupted'])
  })

  it('transcribes audio via registered STT provider', async () => {
    const mockSTT: SpeechToTextProvider = {
      id: 'mock-stt',
      locality: 'cloud',
      supportsStreaming: () => false,
      transcribe: vi.fn().mockResolvedValue({
        text: 'Jarvis open project',
        durationMs: 120
      } satisfies Transcript),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'mock-stt' })
    }

    const manager = new VoiceManager({
      config: { sttProvider: 'mock-stt' },
      sttProviders: [mockSTT]
    })

    const sampleAudio: AudioInput = {
      data: new Uint8Array([0, 1, 2, 3]),
      sampleRateHz: 16000,
      channels: 1,
      format: 'pcm16'
    }

    const transcript = await manager.transcribe(sampleAudio)
    expect(transcript.text).toBe('Jarvis open project')
    expect(mockSTT.transcribe).toHaveBeenCalled()
    expect(manager.getState()).toBe('idle')
  })

  it('cascades to fallback TTS provider if primary fails', async () => {
    const failingPrimary: TextToSpeechProvider = {
      id: 'failing-primary',
      locality: 'cloud',
      supportsStreaming: () => false,
      synthesize: vi.fn().mockRejectedValue(new Error('Network timeout')),
      healthCheck: vi.fn().mockResolvedValue({ ok: false, providerId: 'failing-primary' })
    }

    const workingFallback: TextToSpeechProvider = {
      id: 'working-fallback',
      locality: 'local',
      supportsStreaming: () => false,
      synthesize: vi.fn().mockResolvedValue({
        data: new Uint8Array([10, 20, 30]),
        sampleRateHz: 16000,
        format: 'wav',
        durationMs: 50
      } satisfies AudioOutput),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'working-fallback' })
    }

    const manager = new VoiceManager({
      config: {
        ttsProvider: 'failing-primary',
        ttsFallbackProvider: 'working-fallback'
      },
      ttsProviders: [failingPrimary, workingFallback]
    })

    const output = await manager.synthesize('Status report, please.')
    expect(failingPrimary.synthesize).toHaveBeenCalled()
    expect(workingFallback.synthesize).toHaveBeenCalled()
    expect(output.format).toBe('wav')
    expect(output.data.length).toBe(3)
    expect(manager.getState()).toBe('idle')
  })

  it('GroqWhisperSTTProvider correctly builds multipart form and parses response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'System check successful', language: 'en', duration: 1.2 })
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const provider = new GroqWhisperSTTProvider({
        apiKey: 'test-groq-key',
        model: 'whisper-large-v3-turbo'
      })

      const audio: AudioInput = {
        data: new Uint8Array(100),
        sampleRateHz: 16000,
        channels: 1,
        format: 'pcm16'
      }

      const result = await provider.transcribe(audio)
      expect(result.text).toBe('System check successful')
      expect(result.language).toBe('en')

      expect(fetchMock).toHaveBeenCalled()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain('api.groq.com')
      expect(init.headers.Authorization).toBe('Bearer test-groq-key')
      expect(init.body).toBeInstanceOf(FormData)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('OpenAITTSProvider correctly calls /v1/audio/speech with json payload', async () => {
    const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockAudioBytes.buffer
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const provider = new OpenAITTSProvider({
        apiKey: 'test-openai-key',
        model: 'tts-1',
        voice: 'fable'
      })

      const output = await provider.synthesize('Greetings!')
      expect(output.format).toBe('mp3')
      expect(output.data.length).toBe(5)

      expect(fetchMock).toHaveBeenCalled()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/audio/speech')
      expect(init.headers.Authorization).toBe('Bearer test-openai-key')
      const payload = JSON.parse(init.body)
      expect(payload.input).toBe('Greetings!')
      expect(payload.voice).toBe('fable')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
