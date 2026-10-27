import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  loadUserMemory,
  saveUserMemory,
  formatUserMemoryPrompt,
  getUserMemoryFilePath
} from '../src/main/memory/user-memory'

describe('User Memory & Preferences Store (USER.md)', () => {
  const testWs = path.join(__dirname, 'fixtures', 'memory-ws')

  beforeEach(() => {
    if (!fs.existsSync(testWs)) {
      fs.mkdirSync(testWs, { recursive: true })
    }
    // Keep each test isolated from any USER.md left behind by another suite.
    fs.rmSync(path.join(testWs, 'USER.md'), { force: true })
  })

  afterEach(() => {
    if (fs.existsSync(testWs)) {
      try {
        fs.rmSync(testWs, { recursive: true, force: true })
      } catch {}
    }
  })

  it('reads default preferences when USER.md does not yet exist', () => {
    const memory = loadUserMemory(testWs)
    expect(memory.preferredChromeProfile).toBe('fennec')
    expect(memory.defaultDevPort).toBe(5173)
    expect(memory.notes).toBeDefined()
    expect(memory.notes?.length).toBeGreaterThan(0)
  })

  it('writes and updates USER.md in structured human-readable Markdown format', () => {
    saveUserMemory(
      {
        name: 'Abdelfetah',
        preferredChromeProfile: 'Profile 4',
        defaultEmail: 'fennec@gmail.com',
        preferredDevCommand: 'npm run dev',
        defaultDevPort: 3000,
        notes: ['Custom note 1: Always check tests.', 'Custom note 2: Clean code.']
      },
      testWs
    )

    const filePath = getUserMemoryFilePath(testWs)
    expect(fs.existsSync(filePath)).toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('**Name**: Abdelfetah')
    expect(content).toContain('**Preferred Chrome Profile**: Profile 4')
    expect(content).toContain('**Default Email**: fennec@gmail.com')
    expect(content).toContain('**Default Dev Port**: 3000')
    expect(content).toContain('- Custom note 1: Always check tests.')

    // Re-read back
    const reloaded = loadUserMemory(testWs)
    expect(reloaded.name).toBe('Abdelfetah')
    expect(reloaded.preferredChromeProfile).toBe('Profile 4')
    expect(reloaded.defaultDevPort).toBe(3000)
    expect(reloaded.notes).toContain('Custom note 1: Always check tests.')
  })

  it('formats user memory into a concise prompt string for system prompt injection', () => {
    const promptStr = formatUserMemoryPrompt({
      name: 'Abdelfetah',
      preferredChromeProfile: 'fennec',
      defaultEmail: 'fennec@example.com',
      preferredDevCommand: 'npm run dev',
      defaultDevPort: 5173,
      notes: ['Keep commits local.']
    })

    expect(promptStr).toContain("User Persona & Identity: Abdelfetah")
    expect(promptStr).toContain("Preferred Google Chrome Profile: 'fennec'")
    expect(promptStr).toContain("Default Email Address/Account: 'fennec@example.com'")
    expect(promptStr).toContain("Keep commits local.")
  })
})
