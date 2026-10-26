import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { ProcessManager } from '../src/main/process/process-manager'
import { isCdpAvailable } from '../src/main/utils/cdp'

describe('CDP Browser Automation & Memory Tools', () => {
  const testWorkspace = path.join(__dirname, 'fixtures', 'cdp-ws')
  let processManager: ProcessManager
  let toolExecutor: ToolExecutor

  beforeEach(() => {
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true })
    }
    processManager = new ProcessManager()
    toolExecutor = new ToolExecutor(undefined, processManager)
  })

  afterEach(async () => {
    await processManager.stopAll()
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true })
      } catch {}
    }
  })

  it('isCdpAvailable returns false gracefully when no browser is debugging on unused port', async () => {
    const available = await isCdpAvailable(19223)
    expect(available).toBe(false)
  })

  it('browser_list_tabs provides clear error guidance when CDP is not yet active on target port', async () => {
    const result = await toolExecutor.executeTool(
      'browser_list_tabs',
      { port: 19224 },
      testWorkspace
    )

    expect(result.toolName).toBe('browser_list_tabs')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Chrome remote debugging is not active on port 19224')
  })

  it('manage_user_memory reads and updates user preferences in USER.md', async () => {
    // 1. Read initial memory
    const readRes = await toolExecutor.executeTool(
      'manage_user_memory',
      { action: 'read' },
      testWorkspace
    )

    expect(readRes.toolName).toBe('manage_user_memory')
    expect(readRes.success).toBe(true)
    expect(readRes.output).toContain('Persistent User Memory (USER.md)')
    expect(readRes.output).toContain('fennec')

    // 2. Update memory
    const updateRes = await toolExecutor.executeTool(
      'manage_user_memory',
      {
        action: 'update',
        updates: {
          preferredChromeProfile: 'Profile 4',
          defaultDevPort: 8080,
          noteToAdd: 'Testing memory update tool.'
        }
      },
      testWorkspace
    )

    expect(updateRes.toolName).toBe('manage_user_memory')
    expect(updateRes.success).toBe(true)
    expect(updateRes.output).toContain('Persistent user memory updated in USER.md')
    expect(updateRes.output).toContain('Profile 4')
    expect(updateRes.output).toContain('Testing memory update tool.')

    // 3. Confirm file updated on disk
    const content = fs.readFileSync(path.join(testWorkspace, 'USER.md'), 'utf-8')
    expect(content).toContain('**Preferred Chrome Profile**: Profile 4')
    expect(content).toContain('**Default Dev Port**: 8080')
    expect(content).toContain('- Testing memory update tool.')
  })

  it('browser_inspect_page returns structured error when CDP port is not listening', async () => {
    const result = await toolExecutor.executeTool(
      'browser_inspect_page',
      { port: 19225 },
      testWorkspace
    )

    expect(result.toolName).toBe('browser_inspect_page')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to inspect page DOM via CDP')
  })

  it('browser_click_element returns structured error when CDP port is not listening', async () => {
    const result = await toolExecutor.executeTool(
      'browser_click_element',
      { selector: 'button.submit-btn', port: 19226 },
      testWorkspace
    )

    expect(result.toolName).toBe('browser_click_element')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to click element')
  })

  it('browser_close_tab returns error when closing non-existent target or port is inactive', async () => {
    const result = await toolExecutor.executeTool(
      'browser_close_tab',
      { targetId: 'non-existent-id', port: 19227 },
      testWorkspace
    )

    expect(result.toolName).toBe('browser_close_tab')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not close tab')
  })

  it('send_gmail supports minimized background launch and reports clean compose status', async () => {
    const result = await toolExecutor.executeTool(
      'send_gmail',
      {
        to: 'recipient@example.com',
        subject: 'Status',
        body: 'Automated notification',
        autoSend: false,
        minimized: true
      },
      testWorkspace
    )

    expect(result.toolName).toBe('send_gmail')
    expect(result.success).toBe(true)
    expect(result.output).toContain("Gmail compose window opened successfully in Chrome")
    expect(result.output).toContain("(minimized)")
  })
})
