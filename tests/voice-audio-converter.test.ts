import { describe, it, expect } from 'vitest'
import {
  pcm16ToWav,
  wavToPcm16,
  float32ToInt16,
  int16ToFloat32
} from '../packages/voice/src/utils/audio-converter'

describe('Voice Audio Converter', () => {
  it('encodes PCM16 into valid WAV and decodes back with exact integrity', () => {
    const originalPcm = new Int16Array([0, 1000, -1000, 32767, -32768, 500, -500])
    const wavBytes = pcm16ToWav(originalPcm, 16000, 1)

    // WAV header is 44 bytes + 14 bytes PCM = 58 bytes
    expect(wavBytes.byteLength).toBe(44 + originalPcm.byteLength)

    // Decode WAV
    const { pcmData, sampleRateHz, channels } = wavToPcm16(wavBytes)
    expect(sampleRateHz).toBe(16000)
    expect(channels).toBe(1)
    expect(pcmData.length).toBe(originalPcm.length)

    for (let i = 0; i < originalPcm.length; i++) {
      expect(pcmData[i]).toBe(originalPcm[i])
    }
  })

  it('accurately normalizes Float32 to Int16 and back', () => {
    const floatSamples = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0])
    const int16Samples = float32ToInt16(floatSamples)

    expect(int16Samples[0]).toBe(0)
    expect(int16Samples[1]).toBe(16383) // 0.5 * 32767
    expect(int16Samples[2]).toBe(-16384) // -0.5 * 32768
    expect(int16Samples[3]).toBe(32767)
    expect(int16Samples[4]).toBe(-32768)

    const reconstructed = int16ToFloat32(int16Samples)
    expect(reconstructed[0]).toBeCloseTo(0.0, 4)
    expect(reconstructed[1]).toBeCloseTo(0.5, 3)
    expect(reconstructed[2]).toBeCloseTo(-0.5, 3)
    expect(reconstructed[3]).toBeCloseTo(1.0, 3)
    expect(reconstructed[4]).toBeCloseTo(-1.0, 3)
  })

  it('rejects malformed WAV files', () => {
    const tooShort = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    expect(() => wavToPcm16(tooShort)).toThrow('Invalid WAV file: buffer too short (<44 bytes)')

    const corruptedHeader = new Uint8Array(44)
    expect(() => wavToPcm16(corruptedHeader)).toThrow('Invalid WAV file: missing RIFF/WAVE signature')
  })
})
