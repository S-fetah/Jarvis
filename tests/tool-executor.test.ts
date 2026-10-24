import { describe, it, expect } from 'vitest'
import path from 'path'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { PolicyEngine } from '../src/main/policy/policy-engine'

describe('ToolExecutor (Read-Only Tool Engine)', () => {
  const workspacePath = path.resolve(__dirname, '..')
  const policyEngine = new PolicyEngine()
  const executor = new ToolExecutor(policyEngine)

  it('workspace_list returns directory structure and respects bounds', async () => {
    const res = await executor.executeTool('workspace_list', { subpath: 'src', maxDepth: 2 }, workspacePath)
    expect(res.success).toBe(true)
    expect(res.toolName).toBe('workspace_list')
    expect(res.output).toContain('### Workspace Directory')
    expect(res.output).toContain('main/')
    expect(res.output).not.toContain('node_modules')
  })

  it('workspace_list rejects path traversal attempts outside workspace', async () => {
    const res = await executor.executeTool('workspace_list', { subpath: '../../' }, workspacePath)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Access denied')
  })

  it('file_read accurately returns file content with line numbers', async () => {
    const res = await executor.executeTool('file_read', { path: 'package.json', startLine: 1, maxLines: 15 }, workspacePath)
    expect(res.success).toBe(true)
    expect(res.toolName).toBe('file_read')
    expect(res.output).toContain('### File: `package.json`')
    expect(res.output).toContain('1 | {')
    expect(res.output).toContain('"name": "jarvis-desktop"')
  })

  it('file_read blocks reading files outside workspace (SEC-006 path traversal)', async () => {
    const res = await executor.executeTool('file_read', { path: '../../Windows/win.ini' }, workspacePath)
    expect(res.success).toBe(false)
    expect(res.error).toContain('outside the approved workspace boundary')
  })

  it('file_read returns error when file does not exist', async () => {
    const res = await executor.executeTool('file_read', { path: 'non_existent_file.xyz' }, workspacePath)
    expect(res.success).toBe(false)
    expect(res.error).toContain('File not found')
  })

  it('project_inspect parses package.json, scripts, and git branch without running code', async () => {
    const res = await executor.executeTool('project_inspect', { detail: 'summary' }, workspacePath)
    expect(res.success).toBe(true)
    expect(res.toolName).toBe('project_inspect')
    expect(res.output).toContain('jarvis-desktop')
    expect(res.output).toContain('npm run dev')
    expect(res.output).toContain('Git Branch')
    expect(res.output).toContain('Electron + Vite')
  })

  it('handles unknown tool names gracefully', async () => {
    const res = await executor.executeTool('delete_database', {}, workspacePath)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unknown tool')
  })
})
