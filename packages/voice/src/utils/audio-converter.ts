/**
 * Audio conversion utilities for voice pipelines.
 * Handles PCM16 <-> WAV formatting, sample rate headers, and Float32 <-> Int16 normalization.
 */

/**
 * Creates a standard 44-byte RIFF/WAVE header for raw 16-bit PCM data.
 */
export function pcm16ToWav(
  pcmData: Uint8Array | Int16Array,
  sampleRateHz = 16000,
  numChannels: 1 | 2 = 1
): Uint8Array {
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRateHz * blockAlign
  const pcmBytes =
    pcmData instanceof Uint8Array
      ? pcmData
      : new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)

  const wavLength = 44 + pcmBytes.byteLength
  const header = new ArrayBuffer(44)
  const view = new DataView(header)

  // Chunk ID "RIFF"
  writeString(view, 0, 'RIFF')
  // ChunkSize (file size - 8)
  view.setUint32(4, wavLength - 8, true)
  // Format "WAVE"
  writeString(view, 8, 'WAVE')

  // Subchunk1 ID "fmt "
  writeString(view, 12, 'fmt ')
  // Subchunk1 Size (16 for standard PCM)
  view.setUint32(16, 16, true)
  // AudioFormat (1 = PCM)
  view.setUint16(20, 1, true)
  // NumChannels
  view.setUint16(22, numChannels, true)
  // SampleRate
  view.setUint32(24, sampleRateHz, true)
  // ByteRate
  view.setUint32(28, byteRate, true)
  // BlockAlign
  view.setUint16(32, blockAlign, true)
  // BitsPerSample
  view.setUint16(34, 16, true)

  // Subchunk2 ID "data"
  writeString(view, 36, 'data')
  // Subchunk2 Size
  view.setUint32(40, pcmBytes.byteLength, true)

  const wavOutput = new Uint8Array(wavLength)
  wavOutput.set(new Uint8Array(header), 0)
  wavOutput.set(pcmBytes, 44)

  return wavOutput
}

/**
 * Parses a standard WAV file and extracts the raw 16-bit PCM samples.
 */
export function wavToPcm16(wavBuffer: Uint8Array): {
  pcmData: Int16Array
  sampleRateHz: number
  channels: number
} {
  if (wavBuffer.byteLength < 44) {
    throw new Error('Invalid WAV file: buffer too short (<44 bytes)')
  }

  const view = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength)

  // Verify RIFF & WAVE headers
  const riff = readString(view, 0, 4)
  const wave = readString(view, 8, 4)
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing RIFF/WAVE signature')
  }

  let offset = 12
  let sampleRateHz = 16000
  let channels = 1
  let dataOffset = -1
  let dataLength = 0

  while (offset + 8 <= wavBuffer.byteLength) {
    const chunkId = readString(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    offset += 8

    if (chunkId === 'fmt ') {
      const formatTag = view.getUint16(offset, true)
      if (formatTag !== 1) {
        throw new Error(`Unsupported WAV format tag: ${formatTag} (only PCM supported)`)
      }
      channels = view.getUint16(offset + 2, true)
      sampleRateHz = view.getUint32(offset + 4, true)
    } else if (chunkId === 'data') {
      dataOffset = offset
      dataLength = chunkSize
      break
    }

    offset += chunkSize
  }

  if (dataOffset === -1) {
    throw new Error('Invalid WAV file: data chunk not found')
  }

  const pcmBytes = wavBuffer.subarray(dataOffset, dataOffset + dataLength)
  const pcmData = new Int16Array(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    Math.floor(pcmBytes.byteLength / 2)
  )

  return { pcmData, sampleRateHz, channels }
}

/**
 * Converts Web Audio Float32Array (-1.0 to 1.0) into Int16Array (-32768 to 32767).
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

/**
 * Converts Int16Array (-32768 to 32767) into Web Audio Float32Array (-1.0 to 1.0).
 */
export function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length)
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0
  }
  return float32Array
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function readString(view: DataView, offset: number, length: number): string {
  let str = ''
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i))
  }
  return str
}
