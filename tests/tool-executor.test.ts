import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ToolExecutor } from '../src/main/tools/tool-executor'
import { PolicyEngine } from '../src/main/policy/policy-engine'

describe('ToolExecutor (Read-Only & Document Engine)', () => {
  const workspacePath = path.resolve(__dirname, '..')
  const outputDirectory = path.resolve(workspacePath, 'output/test-tools')
  const policyEngine = new PolicyEngine()
  const executor = new ToolExecutor(policyEngine)

  afterAll(() => {
    if (fs.existsSync(outputDirectory)) {
      fs.rmSync(outputDirectory, { recursive: true, force: true })
    }
  })

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

  // --- Phase 3 Tests: Documents and File Creation ---

  it('create_pdf writes a verified PDF report to the output directory', async () => {
    const res = await executor.executeTool(
      'create_pdf',
      {
        title: 'Project Audit Report',
        content: '# Executive Summary\n\nAll security and agent requirements satisfied.',
        filename: 'audit-report.pdf',
        sources: ['https://github.com/S-fetah/myJarvis']
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(true)
    expect(res.toolName).toBe('create_pdf')
    expect(res.output).toContain('PDF Generated Successfully')
    expect(res.output).toContain('audit-report.pdf')

    const createdPath = path.join(outputDirectory, 'audit-report.pdf')
    expect(fs.existsSync(createdPath)).toBe(true)
  })

  it('file_write_new safely writes a new text file within output boundaries', async () => {
    const targetRelPath = path.relative(workspacePath, path.join(outputDirectory, 'notes.md'))
    const res = await executor.executeTool(
      'file_write_new',
      {
        path: targetRelPath,
        content: '# Research Notes\n\n- Completed Phase 1 and 2\n- Now executing Phase 3',
        overwrite: true
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(true)
    expect(res.toolName).toBe('file_write_new')
    expect(res.output).toContain('File Written Successfully')
  })

  it('file_write_new refuses accidental overwrite when overwrite is false', async () => {
    const targetRelPath = path.relative(workspacePath, path.join(outputDirectory, 'notes.md'))
    const res = await executor.executeTool(
      'file_write_new',
      {
        path: targetRelPath,
        content: 'New content',
        overwrite: false
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('already exists. Pass overwrite: true')
  })

  it('file_write_new blocks path traversal escaping workspace and output directory', async () => {
    const res = await executor.executeTool(
      'file_write_new',
      {
        path: '../../Windows/system32/evil.txt',
        content: 'malicious'
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('resolves outside allowed workspace and output boundaries')
  })

  it('file_write_new gates creation of dangerous executable scripts (SEC-007)', async () => {
    const scriptRelPath = path.relative(workspacePath, path.join(outputDirectory, 'setup.bat'))
    const res = await executor.executeTool(
      'file_write_new',
      {
        path: scriptRelPath,
        content: '@echo off\nstart calc.exe\n'
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('Security restriction')
  })

  it('download_file blocks non-http protocols (e.g. file://)', async () => {
    const res = await executor.executeTool(
      'download_file',
      {
        url: 'file:///C:/Windows/win.ini'
      },
      workspacePath,
      outputDirectory
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('Forbidden protocol')
  })

  it('handles unknown tool names gracefully', async () => {
    const res = await executor.executeTool('delete_database', {}, workspacePath)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unknown tool')
  })
})
