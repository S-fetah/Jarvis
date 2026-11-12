import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { detectVoiceFeatureStatus } from '@jarvis/voice'

describe('@jarvis/voice optional feature module', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-voice-opt-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  it('reports not installed when optional voice models directory is missing or empty', () => {
    const missing = detectVoiceFeatureStatus(path.join(tempDir, 'nonexistent'))
    expect(missing.optional).toBe(true)
    expect(missing.installed).toBe(false)
    expect(missing.enabled).toBe(false)
    expect(missing.installedModels).toEqual([])

    const empty = detectVoiceFeatureStatus(tempDir)
    expect(empty.installed).toBe(false)
  })

  it('detects downloaded ONNX/model folders when voice add-on is installed', () => {
    fs.writeFileSync(path.join(tempDir, 'silero_vad.onnx'), 'stub')
    fs.mkdirSync(path.join(tempDir, 'kokoro-82m-onnx'))

    const status = detectVoiceFeatureStatus(tempDir, true)
    expect(status.optional).toBe(true)
    expect(status.installed).toBe(true)
    expect(status.enabled).toBe(true)
    expect(status.installedModels).toContain('silero_vad.onnx')
    expect(status.installedModels).toContain('kokoro-82m-onnx')
  })
})
