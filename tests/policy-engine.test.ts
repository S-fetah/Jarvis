import { describe, it, expect } from 'vitest'
import { PolicyEngine } from '../src/main/policy/policy-engine'

describe('PolicyEngine (ADR-004 Verification)', () => {
  const workspace = 'C:\\work\\softwares\\jarvis'
  const engine = new PolicyEngine('test-secret')

  it('allows read-in actions inside workspace without approval', () => {
    const res = engine.evaluateAction({
      actionType: 'file_read',
      workspacePath: workspace,
      targetPath: 'C:\\work\\softwares\\jarvis\\README.md',
      arguments: { path: 'README.md' }
    })

    expect(res.allowed).toBe(true)
    expect(res.requiresApproval).toBe(false)
    expect(res.category).toBe('read_in')
  })

  it('gates read-out actions outside workspace with approval', () => {
    const res = engine.evaluateAction({
      actionType: 'file_read',
      workspacePath: workspace,
      targetPath: 'C:\\Users\\Desktop\\sensitive.txt',
      arguments: { path: 'C:\\Users\\Desktop\\sensitive.txt' }
    })

    expect(res.allowed).toBe(false)
    expect(res.requiresApproval).toBe(true)
    expect(res.category).toBe('read_out')
    expect(res.approvalRequest).toBeDefined()
  })

  it('gates process spawning and dev server starts with approval', () => {
    const res = engine.evaluateAction({
      actionType: 'start_dev_server',
      workspacePath: workspace,
      command: 'npm run dev',
      arguments: { script: 'dev', port: 3000 }
    })

    expect(res.allowed).toBe(false)
    expect(res.requiresApproval).toBe(true)
    expect(res.category).toBe('process')
    expect(res.approvalRequest).toBeDefined()
  })

  it('allows approval resolution and verifies matching arguments', () => {
    const res = engine.evaluateAction({
      actionType: 'run_project_command',
      workspacePath: workspace,
      command: 'git status',
      arguments: { cmd: 'git status' }
    })

    const approvalId = res.approvalRequest!.id
    expect(engine.resolveApproval(approvalId, 'granted')).toBe(true)

    // Verification succeeds with identical arguments
    expect(engine.verifyApprovedAction(approvalId, { cmd: 'git status' })).toBe(true)
  })

  it('invalidates approval immediately if arguments are tampered with (ADR-004 Anti-Tampering)', () => {
    const res = engine.evaluateAction({
      actionType: 'run_project_command',
      workspacePath: workspace,
      command: 'npm test',
      arguments: { script: 'test' }
    })

    const approvalId = res.approvalRequest!.id
    expect(engine.resolveApproval(approvalId, 'granted')).toBe(true)

    // Attacker modifies argument from 'test' to 'rm -rf /'
    const tamperedArgs = { script: 'rm -rf /' }
    expect(engine.verifyApprovedAction(approvalId, tamperedArgs)).toBe(false)
  })

  it('permanently rejects denied actions and prevents silent retries', () => {
    const res = engine.evaluateAction({
      actionType: 'file_modify',
      workspacePath: workspace,
      targetPath: 'C:\\work\\softwares\\jarvis\\src\\main.ts',
      arguments: { path: 'src\\main.ts', append: 'malicious' }
    })

    const approvalId = res.approvalRequest!.id
    expect(engine.resolveApproval(approvalId, 'denied')).toBe(true)

    // Attempting to verify or execute a denied action fails
    expect(engine.verifyApprovedAction(approvalId, { path: 'src\\main.ts', append: 'malicious' })).toBe(false)
  })
})
