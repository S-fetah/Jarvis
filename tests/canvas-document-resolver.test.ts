import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { detectAssetInMessage } from '../src/renderer/src/components/chat/MessageList'

describe('Canvas Document & Asset Detection', () => {
  it('detects absolute Windows path to PDF over bare filename', () => {
    const message =
      'Done, man! 📄\n\n' +
      "I've generated a full PDF summary of our chat session. Here's what's in it:\n\n" +
      '📄 File: chat_summary.pdf 📍 Location: C:\\work\\softwares\\jarvis\\output\\chat_summary.pdf 📊 Size: 94.2 KB\n\n' +
      "What's covered:\n- Complete timeline"

    const asset = detectAssetInMessage(message)
    expect(asset).not.toBeNull()
    expect(asset?.type).toBe('pdf')
    expect(asset?.isPdf).toBe(true)
    expect(asset?.url).toBe('C:\\work\\softwares\\jarvis\\output\\chat_summary.pdf')
    expect(asset?.label).toBe('chat_summary.pdf')
  })

  it('detects output-relative path to PDF', () => {
    const message = 'I have written the analysis report to output/audit-report.pdf'
    const asset = detectAssetInMessage(message)
    expect(asset).not.toBeNull()
    expect(asset?.type).toBe('pdf')
    expect(asset?.url).toBe('output/audit-report.pdf')
    expect(asset?.label).toBe('audit-report.pdf')
  })

  it('detects bare PDF filename when no directory prefix is present', () => {
    const message = 'Created chat_summary.pdf in your workspace.'
    const asset = detectAssetInMessage(message)
    expect(asset).not.toBeNull()
    expect(asset?.type).toBe('pdf')
    expect(asset?.url).toBe('chat_summary.pdf')
    expect(asset?.label).toBe('chat_summary.pdf')
  })

  it('detects live local dev server URL with highest priority', () => {
    const message = 'Started dev server at http://localhost:5173/dashboard with report at output/summary.pdf'
    const asset = detectAssetInMessage(message)
    expect(asset).not.toBeNull()
    expect(asset?.type).toBe('browser')
    expect(asset?.isPdf).toBe(false)
    expect(asset?.url).toBe('http://localhost:5173/dashboard')
  })

  it('returns null for messages with no URLs or PDFs', () => {
    const message = 'Hello! I am Jarvis, your assistive AI desktop assistant. How can I help you today?'
    const asset = detectAssetInMessage(message)
    expect(asset).toBeNull()
  })
})

describe('Candidate Document Path Resolution Simulation', () => {
  const rootDir = process.cwd()
  const outDir = path.join(rootDir, 'output')
  const samplePdf = path.join(outDir, 'chat_summary.pdf')

  function resolveCandidate(inputPath: string, wsPath: string, outputDir: string): string | null {
    let cleanPath = inputPath.trim().replace(/^['"`]+|['"`]+$/g, '')
    if (cleanPath.startsWith('file:///')) cleanPath = cleanPath.slice(8)
    else if (cleanPath.startsWith('file://')) cleanPath = cleanPath.slice(7)

    const baseName = path.basename(cleanPath)
    const candidates = [
      path.resolve(cleanPath),
      path.resolve(wsPath, cleanPath),
      path.resolve(outputDir, cleanPath),
      path.resolve(outputDir, baseName),
      path.resolve(wsPath, 'output', cleanPath),
      path.resolve(wsPath, 'output', baseName),
      path.resolve(wsPath, baseName)
    ]

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand
      }
    }
    return null
  }

  it('resolves bare filename to output directory', () => {
    if (fs.existsSync(samplePdf)) {
      const resolved = resolveCandidate('chat_summary.pdf', rootDir, outDir)
      expect(resolved).not.toBeNull()
      expect(resolved?.toLowerCase()).toBe(samplePdf.toLowerCase())
    }
  })

  it('resolves output-relative path', () => {
    if (fs.existsSync(samplePdf)) {
      const resolved = resolveCandidate('output/chat_summary.pdf', rootDir, outDir)
      expect(resolved).not.toBeNull()
      expect(resolved?.toLowerCase()).toBe(samplePdf.toLowerCase())
    }
  })

  it('resolves absolute path directly', () => {
    if (fs.existsSync(samplePdf)) {
      const resolved = resolveCandidate(samplePdf, rootDir, outDir)
      expect(resolved).not.toBeNull()
      expect(resolved?.toLowerCase()).toBe(samplePdf.toLowerCase())
    }
  })

  it('returns null for non-existent files', () => {
    const resolved = resolveCandidate('non_existent_file_12345.pdf', rootDir, outDir)
    expect(resolved).toBeNull()
  })
})
