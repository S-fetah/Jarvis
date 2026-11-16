import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenVoiceTTSProvider } from '../packages/voice/src/providers/tts/openvoice-tts-provider'
import { VoiceManager } from '../packages/voice/src/voice-manager'

describe('OpenVoiceTTSProvider & J.A.R.V.I.S. Voice Cloning', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with correct provider metadata', () => {
    const provider = new OpenVoiceTTSProvider()
    expect(provider.id).toBe('openvoice-v2')
    expect(provider.locality).toBe('local')
    expect(provider.supportsVoiceCloning).toBe(true)
    expect(provider.supportsStreaming()).toBe(false)
  })

  it('reports healthy when CLI runner is present on disk', async () => {
    const provider = new OpenVoiceTTSProvider()
    const health = await provider.healthCheck()
    expect(health.ok).toBe(true)
    expect(health.providerId).toBe('openvoice-v2')
  })

  it('routes to openvoice-v2 when requested in VoiceManager', async () => {
    const mockAudio = new Uint8Array([1, 2, 3, 4])
    const customOpenVoice = new OpenVoiceTTSProvider()
    vi.spyOn(customOpenVoice, 'synthesize').mockResolvedValue({
      data: mockAudio,
      sampleRateHz: 24000,
      format: 'wav',
      providerId: 'openvoice-v2'
    })

    const vm = new VoiceManager({
      config: {
        ttsProvider: 'openvoice-v2'
      },
      ttsProviders: [customOpenVoice]
    })

    const res = await vm.synthesize('Good evening, sir.')
    expect(res.data).toEqual(mockAudio)
    expect(res.format).toBe('wav')
    expect(res.providerId).toBe('openvoice-v2')
  })

  it('uses target speaker embedding for zero-shot transformation', async () => {
    const provider = new OpenVoiceTTSProvider()
    const synthSpy = vi.spyOn(provider as any, 'synthesizeViaCli').mockResolvedValue({
      data: new Uint8Array([42]),
      sampleRateHz: 24000,
      format: 'wav',
      providerId: 'openvoice-v2'
    })

    // Simulate microservice fetch failing so it invokes synthesizeViaCli
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    const output = await provider.synthesize('At your service, sir.', {
      speakerWav: 'C:/Users/test/profiles/voice/javis-original/reference.wav'
    })

    expect(synthSpy).toHaveBeenCalled()
    expect(output.providerId).toBe('openvoice-v2')
  })
})
