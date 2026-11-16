import { describe, it, expect, vi } from 'vitest'
import {
  SileroVADProvider,
  SpeechBoundaryDetector,
  VoiceManager,
  type SpeechToTextProvider,
  type AudioInput,
  type Transcript
} from '../packages/voice/src'

describe('SileroVADProvider', () => {
  it('initializes and runs inference on silence and validates bounded probabilities', async () => {
    const vad = new SileroVADProvider({ threshold: 0.5 })
    const health = await vad.healthCheck()
    expect(health.ok).toBe(true)
    expect(health.message).toContain('Silero VAD v5 ONNX engine active')

    // Silence frame (512 samples of zeros)
    const silentFrame = new Int16Array(512)
    const silentProb = await vad.processFrameProb(silentFrame, 16000)
    expect(silentProb).toBeLessThan(0.01)
    expect(silentProb).toBeGreaterThanOrEqual(0.0)

    // Synchronous evaluation
    const silentDecision = vad.processFrame(silentFrame)
    expect(silentDecision).toBe(false)

    // Test state reset
    vad.reset()
    expect(vad.processFrame(silentFrame)).toBe(false)
  })

  it('falls back gracefully to energy calculation if model is unavailable or throws', async () => {
    const fallbackVad = new SileroVADProvider({
      modelPath: 'C:/non-existent-path/non-existent.onnx',
      threshold: 0.2
    })
    const health = await fallbackVad.healthCheck()
    expect(health.ok).toBe(true)
    expect(health.message).toContain('energy fallback')

    const silentFrame = new Int16Array(512)
    const silenceProb = await fallbackVad.processFrameProb(silentFrame)
    expect(silenceProb).toBe(0)

    const loudFrame = new Int16Array(512).fill(12000)
    const loudProb = await fallbackVad.processFrameProb(loudFrame)
    expect(loudProb).toBeGreaterThan(0.2)
  })
})

describe('SpeechBoundaryDetector', () => {
  it('buffers raw audio chunks of arbitrary sizes into fixed 512-sample frames', async () => {
    const vad = new SileroVADProvider()
    const detector = new SpeechBoundaryDetector({
      vadProvider: vad,
      frameSize: 512,
      minSpeechFrames: 2,
      silenceTimeoutMs: 100
    })

    const frameEvents: Array<{ prob: number; hasSpeech: boolean }> = []
    detector.on('frame', (data) => {
      frameEvents.push(data)
    })

    // Feed chunks that do not align with 512 samples (e.g. 300 samples each)
    // 300 * 3 = 900 samples -> 1 full frame of 512, residual 388
    await detector.processAudioChunk(new Int16Array(300))
    expect(frameEvents.length).toBe(0)

    await detector.processAudioChunk(new Int16Array(300))
    expect(frameEvents.length).toBe(1)

    await detector.processAudioChunk(new Int16Array(300))
    expect(frameEvents.length).toBe(1)

    // 900 + 124 = 1024 -> exactly 2 frames
    await detector.processAudioChunk(new Int16Array(124))
    expect(frameEvents.length).toBe(2)
  })

  it('triggers speechStart and speechEnd based on onset hysteresis and silence timeout', async () => {
    // Custom mock VAD returning controlled probabilities
    let currentProb = 0.05
    const mockVad = {
      id: 'mock-vad',
      threshold: 0.5,
      sampleRate: 16000,
      processFrameProb: vi.fn(async () => currentProb),
      processFrame: vi.fn(() => currentProb >= 0.5),
      reset: vi.fn(),
      healthCheck: vi.fn(async () => ({ ok: true, providerId: 'mock-vad' }))
    } as unknown as SileroVADProvider

    const detector = new SpeechBoundaryDetector({
      vadProvider: mockVad,
      frameSize: 512,
      minSpeechFrames: 2,
      silenceTimeoutMs: 64 // 2 frames of 32ms = 64ms silence timeout
    })

    let speechStarted = false
    let speechEndedAudio: AudioInput | null = null

    detector.on('speechStart', () => {
      speechStarted = true
    })

    detector.on('speechEnd', (audio: AudioInput) => {
      speechEndedAudio = audio
    })

    // Frame 1: Silent
    await detector.processAudioChunk(new Int16Array(512))
    expect(speechStarted).toBe(false)

    // Frame 2: Loud (1st consecutive speech frame, needs 2 to trigger onset)
    currentProb = 0.85
    await detector.processAudioChunk(new Int16Array(512))
    expect(speechStarted).toBe(false)

    // Frame 3: Loud (2nd consecutive speech frame -> triggers speechStart)
    await detector.processAudioChunk(new Int16Array(512))
    expect(speechStarted).toBe(true)

    // Now send silence to trigger silence timeout
    currentProb = 0.05
    // Frame 4 (32ms silence)
    await detector.processAudioChunk(new Int16Array(512))
    expect(speechEndedAudio).toBeNull()

    // Frame 5 (64ms silence -> hits silenceTimeoutMs -> triggers speechEnd)
    await detector.processAudioChunk(new Int16Array(512))
    expect(speechEndedAudio).not.toBeNull()
    expect(speechEndedAudio!.sampleRateHz).toBe(16000)
    expect(speechEndedAudio!.format).toBe('pcm16')
    expect(detector.isCurrentlySpeaking()).toBe(false)
  })
})

describe('VoiceManager Instant Barge-in and State Interruption', () => {
  it('immediately interrupts TTS playback when user speech starts (barge-in)', async () => {
    let vadProb = 0.1
    const mockVad = {
      id: 'mock-vad',
      threshold: 0.5,
      sampleRate: 16000,
      processFrameProb: vi.fn(async () => vadProb),
      processFrame: vi.fn(() => vadProb >= 0.5),
      reset: vi.fn(),
      healthCheck: vi.fn(async () => ({ ok: true, providerId: 'mock-vad' }))
    } as unknown as SileroVADProvider

    const mockSTT: SpeechToTextProvider = {
      id: 'mock-stt',
      locality: 'cloud',
      supportsStreaming: () => false,
      transcribe: vi.fn().mockResolvedValue({
        text: 'Stop talking and listen to me',
        durationMs: 250
      } satisfies Transcript),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'mock-stt' })
    }

    const manager = new VoiceManager({
      config: {
        sttProvider: 'mock-stt',
        vadEnabled: true,
        interruptOnUserSpeech: true
      },
      vadProvider: mockVad,
      sttProviders: [mockSTT]
    })

    const events: string[] = []
    manager.onVoiceEvent((evt) => {
      events.push(evt.type)
    })

    // Simulate Jarvis currently speaking
    manager.setState('speaking')
    expect(manager.getState()).toBe('speaking')

    // Feed silent frames -> remains speaking
    vadProb = 0.05
    await manager.processAudioStreamChunk(new Int16Array(512))
    expect(manager.getState()).toBe('speaking')

    // Feed 2 consecutive speech frames -> triggers barge-in!
    vadProb = 0.9
    await manager.processAudioStreamChunk(new Int16Array(512))
    expect(manager.getState()).toBe('speaking') // 1st frame: onset not met yet

    await manager.processAudioStreamChunk(new Int16Array(512)) // 2nd frame: speechStart!

    // Barge-in must transition state to listening and emit voice:interrupted
    expect(events).toContain('voice:interrupted')
    expect(manager.getState()).toBe('listening')
  })

  it('triggers auto-transcription on speechEnd when in listening state', async () => {
    let vadProb = 0.9
    const mockVad = {
      id: 'mock-vad',
      threshold: 0.5,
      sampleRate: 16000,
      processFrameProb: vi.fn(async () => vadProb),
      processFrame: vi.fn(() => vadProb >= 0.5),
      reset: vi.fn(),
      healthCheck: vi.fn(async () => ({ ok: true, providerId: 'mock-vad' }))
    } as unknown as SileroVADProvider

    const mockSTT: SpeechToTextProvider = {
      id: 'mock-stt',
      locality: 'cloud',
      supportsStreaming: () => false,
      transcribe: vi.fn().mockResolvedValue({
        text: 'What is the current system load?',
        durationMs: 150
      } satisfies Transcript),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, providerId: 'mock-stt' })
    }

    const manager = new VoiceManager({
      config: {
        sttProvider: 'mock-stt',
        vadEnabled: true,
        silenceTimeoutMs: 64
      },
      vadProvider: mockVad,
      sttProviders: [mockSTT]
    })

    // User starts speaking from idle
    await manager.processAudioStreamChunk(new Int16Array(512))
    await manager.processAudioStreamChunk(new Int16Array(512))
    expect(manager.getState()).toBe('listening')

    // User stops speaking (2 frames of silence = 64ms)
    vadProb = 0.05
    await manager.processAudioStreamChunk(new Int16Array(512))
    await manager.processAudioStreamChunk(new Int16Array(512))

    // Allow async auto-transcribe promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockSTT.transcribe).toHaveBeenCalled()
    expect(manager.getState()).toBe('idle')
  })
})
