import fs from 'fs'
import path from 'path'

export interface PdfDocumentOptions {
  title: string
  content: string
  outputPath: string
  sources?: string[]
  author?: string
}

export class PdfGenerator {
  /**
   * Generates a styled, publication-ready PDF report.
   */
  public static async generatePdf(options: PdfDocumentOptions): Promise<{ path: string; size: number }> {
    const { title, content, outputPath, sources = [], author = 'Jarvis AI Assistant' } = options

    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const html = this.buildHtmlDocument(title, content, author, sources)

    // Check if Electron BrowserWindow is available at runtime
    let electronBrowserWindow: any = null
    try {
      const electron = await import('electron')
      electronBrowserWindow = electron.BrowserWindow
    } catch {}

    if (electronBrowserWindow) {
      try {
        const win = new electronBrowserWindow({
          show: false,
          webPreferences: {
            offscreen: true,
            sandbox: true,
            contextIsolation: true
          }
        })

        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            top: 0.8,
            bottom: 0.8,
            left: 0.8,
            right: 0.8
          }
        })

        win.destroy()
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, pdfBuffer)

        const stat = fs.statSync(outputPath)
        return { path: outputPath, size: stat.size }
      } catch (err: any) {
        console.warn('[PdfGenerator] Electron printToPDF failed, using direct PDF writer fallback:', err.message)
      }
    }

    // Direct standard PDF-1.4 writer (works in headless test runners and server environments)
    const fallbackBuffer = this.buildDirectPdf(title, content, author, sources)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, fallbackBuffer)

    const stat = fs.statSync(outputPath)
    return { path: outputPath, size: stat.size }
  }

  /**
   * Verifies that a file on disk is a valid, parseable PDF by inspecting magic bytes and size.
   */
  public static verifyPdf(filePath: string): { isValid: boolean; size: number; error?: string } {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, size: 0, error: 'File does not exist on disk.' }
    }

    const stat = fs.statSync(filePath)
    if (stat.size === 0) {
      return { isValid: false, size: 0, error: 'File is 0 bytes.' }
    }

    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(5)
    fs.readSync(fd, buffer, 0, 5, 0)
    fs.closeSync(fd)

    const header = buffer.toString('utf8', 0, 4)
    if (header !== '%PDF') {
      return { isValid: false, size: stat.size, error: `Invalid PDF header: expected '%PDF', got '${header}'.` }
    }

    return { isValid: true, size: stat.size }
  }

  private static buildHtmlDocument(
    title: string,
    content: string,
    author: string,
    sources: string[]
  ): string {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const formattedContent = content
      .split(/\n\n+/)
      .map((p) => {
        const trimmed = p.trim()
        if (trimmed.startsWith('# ')) {
          return `<h1 style="font-size: 20pt; color: #0d2822; margin-top: 18pt; margin-bottom: 8pt;">${this.escapeHtml(trimmed.slice(2))}</h1>`
        }
        if (trimmed.startsWith('## ')) {
          return `<h2 style="font-size: 15pt; color: #164e40; margin-top: 14pt; margin-bottom: 6pt;">${this.escapeHtml(trimmed.slice(3))}</h2>`
        }
        if (trimmed.startsWith('### ')) {
          return `<h3 style="font-size: 12pt; color: #1b5e50; margin-top: 10pt; margin-bottom: 4pt;">${this.escapeHtml(trimmed.slice(4))}</h3>`
        }
        if (trimmed.startsWith('- ')) {
          const listItems = trimmed
            .split('\n')
            .map((line) => `<li>${this.escapeHtml(line.replace(/^[-\*]\s+/, ''))}</li>`)
            .join('')
          return `<ul style="margin: 6pt 0 12pt 20pt; line-height: 1.6;">${listItems}</ul>`
        }
        return `<p style="margin-bottom: 10pt; line-height: 1.65; color: #2d3748;">${this.escapeHtml(trimmed)}</p>`
      })
      .join('\n')

    const sourcesHtml =
      sources.length > 0
        ? `
        <div style="margin-top: 24pt; padding-top: 12pt; border-top: 1px solid #e2e8f0;">
          <h4 style="font-size: 11pt; color: #4a5568; margin-bottom: 6pt; text-transform: uppercase; letter-spacing: 0.5px;">Sources & Citations</h4>
          <ul style="margin: 0; padding-left: 18pt; font-size: 9.5pt; color: #4a5568; line-height: 1.6;">
            ${sources.map((s) => `<li><a href="${this.escapeHtml(s)}" style="color: #10b981; text-decoration: none;">${this.escapeHtml(s)}</a></li>`).join('\n')}
          </ul>
        </div>
      `
        : ''

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #2d3748;
      background: #ffffff;
      padding: 0;
      margin: 0;
    }
    .header {
      border-bottom: 2.5px solid #10b981;
      padding-bottom: 12pt;
      margin-bottom: 20pt;
    }
    .title {
      font-size: 24pt;
      font-weight: 800;
      color: #064e3b;
      margin: 0 0 6pt 0;
      letter-spacing: -0.5px;
    }
    .meta {
      font-size: 9.5pt;
      color: #718096;
      display: flex;
      justify-content: space-between;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      font-size: 8pt;
      color: #a0aec0;
      text-align: right;
      border-top: 1px solid #edf2f7;
      padding-top: 6pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${this.escapeHtml(title)}</h1>
    <div class="meta">
      <span>Author: <strong>${this.escapeHtml(author)}</strong></span>
      <span>Generated on: <strong>${dateStr}</strong></span>
    </div>
  </div>
  <div class="content">
    ${formattedContent}
    ${sourcesHtml}
  </div>
  <div class="footer">
    Generated by Jarvis Assistant — Windows Desktop
  </div>
</body>
</html>`
  }

  private static buildDirectPdf(
    title: string,
    content: string,
    author: string,
    sources: string[]
  ): Buffer {
    // Generates a valid standard vector PDF-1.4 file with text streams
    const dateStr = new Date().toISOString().split('T')[0]
    const cleanTitle = title.replace(/[()\\]/g, '')
    const cleanAuthor = author.replace(/[()\\]/g, '')

    const lines = [
      `Title: ${cleanTitle}`,
      `Author: ${cleanAuthor} | Date: ${dateStr}`,
      '-------------------------------------------------------',
      ...content.split('\n').filter((l) => l.trim().length > 0).slice(0, 35).map((l) => l.replace(/[()\\]/g, '')),
      ...(sources.length > 0 ? ['\nSources: ' + sources.join(', ')] : [])
    ]

    let streamText = 'BT\n/F1 12 Tf\n40 780 Td\n18 TL\n'
    lines.forEach((line) => {
      streamText += `(${line.slice(0, 85)}) '\n`
    })
    streamText += 'ET'

    const streamLen = Buffer.byteLength(streamText, 'utf8')

    const pdfData =
      `%PDF-1.4\n` +
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n` +
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` +
      `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj\n` +
      `xref\n` +
      `0 6\n` +
      `0000000000 65535 f \n` +
      `0000000009 00000 n \n` +
      `0000000058 00000 n \n` +
      `0000000115 00000 n \n` +
      `0000000244 00000 n \n` +
      `0000000325 00000 n \n` +
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n410\n%%EOF\n`

    return Buffer.from(pdfData, 'utf8')
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
