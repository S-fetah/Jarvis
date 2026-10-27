import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { PolicyEngine } from '../src/main/policy/policy-engine'
import { JARVIS_TOOLS, ScreenCaptureSchema } from '../src/main/tools/tool-registry'
import { exportDiagnosticBundle } from '../src/main/utils/diagnostics'
import { JarvisDatabase } from '../src/main/storage/database'
import { JarvisSettings } from '../src/shared/types'

describe('Phase 6: Windows Integration, Diagnostics & Screen Capture', () => {
  const workspacePath = path.resolve(__dirname, '..')
  const testOutputDir = path.resolve(workspacePath, 'output/test-phase6')
  const testDbDir = path.resolve(workspacePath, 'userData/test-phase6')
  const testDbPath = path.join(testDbDir, 'test-phase6.sqlite')
  const policyEngine = new PolicyEngine()
  const executor = new ToolExecutor(policyEngine)
  let db: JarvisDatabase

  beforeEach(async () => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true })
    }
    db = new JarvisDatabase(testDbPath)
    await db.initialize()
  })

  afterEach(() => {
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true })
      }
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true })
      }
    } catch {}
  })

  describe('1. Screen Capture Tool (screen_capture)', () => {
    it('validates ScreenCaptureSchema for valid and invalid arguments', () => {
      const validArgs = ScreenCaptureSchema.parse({ target: 'primary_display', filename: 'preview.png' })
      expect(validArgs.target).toBe('primary_display')
      expect(validArgs.filename).toBe('preview.png')

      const activeWindowArgs = ScreenCaptureSchema.parse({ target: 'active_window' })
      expect(activeWindowArgs.target).toBe('active_window')

      const defaultArgs = ScreenCaptureSchema.parse({})
      expect(defaultArgs.target).toBe('primary_display')

      expect(() => ScreenCaptureSchema.parse({ target: 'invalid_mode' })).toThrow()
    })

    it('is registered in JARVIS_TOOLS catalog', () => {
      const tool = JARVIS_TOOLS.find((t) => t.function.name === 'screen_capture')
      expect(tool).toBeDefined()
      expect(tool?.function.description).toContain('Captures a high-resolution screenshot')
    })

    it('executes screen_capture and outputs PNG file inside screenshots folder', async () => {
      const result = await executor.executeTool(
        'screen_capture',
        { target: 'primary_display', filename: 'test_cap.png' },
        workspacePath,
        testOutputDir
      )

      expect(result.success).toBe(true)
      expect(result.toolName).toBe('screen_capture')
      expect(result.output).toContain('test_cap.png')

      const screenshotsDir = path.join(testOutputDir, 'screenshots')
      const targetFile = path.join(screenshotsDir, 'test_cap.png')
      expect(fs.existsSync(targetFile)).toBe(true)
      const stats = fs.statSync(targetFile)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('sanitizes filename to prevent directory traversal outside screenshots directory', async () => {
      const traversalName = '../../escaped_screen.png'
      const result = await executor.executeTool(
        'screen_capture',
        { target: 'primary_display', filename: traversalName },
        workspacePath,
        testOutputDir
      )

      expect(result.success).toBe(true)
      const screenshotsDir = path.join(testOutputDir, 'screenshots')
      const targetFile = path.join(screenshotsDir, 'escaped_screen.png')
      expect(fs.existsSync(targetFile)).toBe(true)

      // Ensure it was NOT written to root or parent
      const escapedFile = path.resolve(testOutputDir, '../escaped_screen.png')
      expect(fs.existsSync(escapedFile)).toBe(false)
    })
  })

  describe('2. Diagnostics Bundle Export (exportDiagnosticBundle)', () => {
    it('exports sanitized Markdown and JSON bundles with SEC-003 secret redaction', async () => {
      const testSettings: JarvisSettings = {
        gatewayUrl: 'http://127.0.0.1:31415/v1',
        apiKey: 'super-secret-sk-live-123456789',
        defaultModel: 'gemini-3.6-flash',
        lightMode: false,
        mascotEnabled: true,
        reduceMotion: false,
        launchOnLogin: true,
        minimizeToTray: true,
        workspacePaths: [workspacePath],
        theme: 'light',
        outputDirectory: testOutputDir
      }

      db.createConversation('Diagnostics Test Conv')

      const result = await exportDiagnosticBundle(testSettings, db, testOutputDir)

      expect(result.success).toBe(true)
      expect(fs.existsSync(result.filePath)).toBe(true)
      expect(fs.existsSync(result.jsonFilePath)).toBe(true)

      // Inspect Markdown content
      const mdContent = fs.readFileSync(result.filePath, 'utf8')
      expect(mdContent).toContain('# Jarvis Diagnostic & Support Bundle')
      expect(mdContent).toContain('System Environment')
      expect(mdContent).toContain('Model Gateway & Configuration')
      expect(mdContent).toContain('screen_capture')
      // STRICT SEC-003: Raw secret API key must never appear
      expect(mdContent).not.toContain('super-secret-sk-live-123456789')
      expect(mdContent).toContain('SEC-003')

      // Inspect JSON content
      const jsonContent = fs.readFileSync(result.jsonFilePath, 'utf8')
      const parsed = JSON.parse(jsonContent)
      expect(parsed.system.platform).toBe(process.platform)
      expect(parsed.database.totalConversations).toBeGreaterThanOrEqual(1)
      expect(parsed.settings.apiKey).toBe('[REDACTED_SEC_003]')
      expect(parsed.settings.launchOnLogin).toBe(true)
      expect(parsed.settings.minimizeToTray).toBe(true)
    })
  })

  describe('3. Database Settings & System Persistence', () => {
    it('persists and retrieves launchOnLogin and minimizeToTray in SQLite', () => {
      db.setSetting('launchOnLogin', 'true')
      db.setSetting('minimizeToTray', 'false')

      expect(db.getSetting('launchOnLogin')).toBe('true')
      expect(db.getSetting('minimizeToTray')).toBe('false')

      db.setSetting('launchOnLogin', 'false')
      expect(db.getSetting('launchOnLogin')).toBe('false')
    })
  })
})
