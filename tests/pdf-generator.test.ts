import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { PdfGenerator } from '../src/main/tools/pdf-generator'

describe('PdfGenerator (Phase 3 Vector Document Engine)', () => {
  const testOutputDir = path.resolve(__dirname, '../output/test-pdf')
  const testPdfPath = path.join(testOutputDir, 'sample-report.pdf')

  afterAll(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  it('generates a valid, parseable PDF file with correct magic bytes', async () => {
    const res = await PdfGenerator.generatePdf({
      title: 'NestJS Authentication Architecture Analysis',
      content:
        '# Executive Summary\n\n' +
        'This document provides architectural recommendations for implementing modern authentication in NestJS.\n\n' +
        '## Key Recommendations\n' +
        '- Use Passport.js with JWT strategies.\n' +
        '- Implement refresh token rotation.\n' +
        '- Guard endpoints with custom Roles decorators.',
      outputPath: testPdfPath,
      sources: ['https://docs.nestjs.com/security/authentication', 'https://jwt.io'],
      author: 'Jarvis Lead Architect'
    })

    expect(fs.existsSync(res.path)).toBe(true)
    expect(res.size).toBeGreaterThan(100)

    // Verify magic bytes (%PDF)
    const verify = PdfGenerator.verifyPdf(res.path)
    expect(verify.isValid).toBe(true)
    expect(verify.size).toBe(res.size)
  })

  it('detects invalid or non-PDF files', () => {
    const fakePath = path.join(testOutputDir, 'not-a-pdf.txt')
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
    fs.writeFileSync(fakePath, 'Hello world', 'utf8')

    const verify = PdfGenerator.verifyPdf(fakePath)
    expect(verify.isValid).toBe(false)
    expect(verify.error).toContain("Invalid PDF header: expected '%PDF'")
  })

  it('handles non-existent file checks gracefully', () => {
    const verify = PdfGenerator.verifyPdf('C:/non-existent-file.pdf')
    expect(verify.isValid).toBe(false)
    expect(verify.error).toContain('does not exist')
  })
})
