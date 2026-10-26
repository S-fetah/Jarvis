import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { ProcessManager } from '../src/main/process/process-manager'

describe('Phase 4: Dev Server, Browser & Code Patching Tools', () => {
  const testWorkspace = path.join(__dirname, 'fixtures', 'phase4-ws')
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
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true })
      } catch {
        // Windows directory handle release tolerance
      }
    }
  })

  it('file_patch successfully modifies file, creates .bak backup, and produces unified diff', async () => {
    const filePath = path.join(testWorkspace, 'app.ts')
    const originalContent = 'export function hello() {\n  return "old message"\n}\n'
    fs.writeFileSync(filePath, originalContent, 'utf-8')

    const result = await toolExecutor.executeTool(
      'file_patch',
      {
        path: 'app.ts',
        findTarget: 'return "old message"',
        replaceContent: 'return "new message"',
        backup: true
      },
      testWorkspace
    )

    expect(result.success).toBe(true)
    expect(result.output).toContain("File 'app.ts' patched successfully.")
    expect(result.output).toContain('Backup saved to app.ts.bak.')
    expect(result.output).toContain('- return "old message"')
    expect(result.output).toContain('+ return "new message"')

    // Verify file content on disk
    const updated = fs.readFileSync(filePath, 'utf-8')
    expect(updated).toContain('return "new message"')

    // Verify backup on disk
    const backup = fs.readFileSync(`${filePath}.bak`, 'utf-8')
    expect(backup).toBe(originalContent)
  })

  it('file_patch blocks directory traversal outside workspace', async () => {
    const result = await toolExecutor.executeTool(
      'file_patch',
      {
        path: '../../secret.txt',
        findTarget: 'foo',
        replaceContent: 'bar'
      },
      testWorkspace
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Path traversal denied')
  })

  it('file_patch returns descriptive error when target snippet is not in file', async () => {
    const filePath = path.join(testWorkspace, 'config.json')
    fs.writeFileSync(filePath, '{"port": 8080}', 'utf-8')

    const result = await toolExecutor.executeTool(
      'file_patch',
      {
        path: 'config.json',
        findTarget: '{"port": 3000}',
        replaceContent: '{"port": 4000}'
      },
      testWorkspace
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("Target snippet not found in 'config.json'")
  })

  it('validates open_browser schema and URL protocol requirements', async () => {
    const invalidProtocol = await toolExecutor.executeTool(
      'open_browser',
      {
        url: 'file:///C:/passwords.txt'
      },
      testWorkspace
    )

    expect(invalidProtocol.success).toBe(false)
    expect(invalidProtocol.error).toContain('Forbidden protocol')
  })

  it('ProcessManager tracks child process state and stops cleanly', async () => {
    // Start a lightweight command as managed dev server (e.g. node -e "...")
    const proc = await processManager.startDevServer({
      command: 'node -e "setInterval(() => console.log(\'tick\'), 500)"',
      workingDirectory: testWorkspace
    })

    expect(proc.pid).toBeGreaterThan(0)
    expect(proc.status).toBe('starting')

    const activeList = processManager.getActiveProcesses()
    expect(activeList.length).toBe(1)
    expect(activeList[0].id).toBe(proc.id)

    // Stop process
    const stopped = await processManager.stopProcess(proc.id)
    expect(stopped).toBe(true)

    const finalState = processManager.getProcess(proc.id)
    expect(finalState?.status).toBe('stopped')
  })
})
