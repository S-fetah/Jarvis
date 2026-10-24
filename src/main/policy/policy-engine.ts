import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { ApprovalRequest, PermissionCategory } from '../../shared/types'

export interface ActionPayload {
  actionType: string
  workspacePath: string
  targetPath?: string
  command?: string
  title?: string
  explanation?: string
  workingDirectory?: string
  safetyImpact?: string
  arguments: Record<string, unknown>
}

export interface PolicyEvaluationResult {
  allowed: boolean
  requiresApproval: boolean
  category: PermissionCategory
  approvalRequest?: ApprovalRequest
  reason: string
}

export class PolicyEngine {
  private sessionSecret: string
  private pendingApprovals: Map<string, ApprovalRequest> = new Map()

  constructor(sessionSecret?: string) {
    this.sessionSecret = sessionSecret || crypto.randomBytes(32).toString('hex')
  }

  /**
   * Deterministically canonicalizes arguments and produces an HMAC-SHA256 digest bound to sessionSecret.
   */
  public computeArgumentsHash(args: Record<string, unknown>): string {
    const sortedKeys = Object.keys(args).sort()
    const canonicalObj: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      canonicalObj[key] = args[key]
    }
    const jsonStr = JSON.stringify(canonicalObj)
    return crypto.createHmac('sha256', this.sessionSecret).update(jsonStr).digest('hex')
  }

  /**
   * Evaluates an intended action against workspace boundaries and permission tiers.
   * Adheres strictly to ADR-004.
   */
  public evaluateAction(payload: ActionPayload): PolicyEvaluationResult {
    const { actionType, workspacePath, targetPath, command, arguments: args } = payload

    const isInsideWorkspace = targetPath
      ? this.isPathInsideWorkspace(targetPath, workspacePath)
      : true

    let category: PermissionCategory
    let requiresApproval = false
    let reason = ''

    switch (actionType) {
      case 'file_read':
      case 'workspace_list':
        if (isInsideWorkspace) {
          category = 'read_in'
          requiresApproval = false
          reason = 'Read within registered workspace allowed by default.'
        } else {
          category = 'read_out'
          requiresApproval = true
          reason = 'Reading files outside registered workspace requires user approval.'
        }
        break

      case 'file_write_new':
        if (isInsideWorkspace) {
          // SEC-007: Block unprompted creation of executable scripts, binaries, or hidden dotfiles
          const ext = targetPath ? path.extname(targetPath).toLowerCase() : ''
          const dangerousExtensions = [
            '.bat', '.cmd', '.ps1', '.exe', '.vbs', '.vbe', '.js', '.jse',
            '.wsf', '.wsh', '.msc', '.msi', '.com', '.scr', '.pif', '.sh'
          ]
          const baseName = targetPath ? path.basename(targetPath) : ''
          const isHidden = baseName.startsWith('.')

          if (dangerousExtensions.includes(ext) || isHidden) {
            category = 'write_in'
            requiresApproval = true
            reason = `Creating executable or hidden file ('${baseName}') inside workspace requires explicit user approval.`
          } else {
            category = 'write_in'
            requiresApproval = false
            reason = 'Creation of non-executable file inside workspace allowed (surfaced in activity timeline).'
          }
        } else {
          category = 'write_out'
          requiresApproval = true
          reason = 'Writing files outside workspace requires explicit user approval.'
        }
        break

      case 'file_modify':
      case 'file_delete':
        if (isInsideWorkspace) {
          category = 'write_in'
          requiresApproval = true
          reason = 'Modifying or deleting existing project files requires user approval.'
        } else {
          category = 'write_out'
          requiresApproval = true
          reason = 'Mutating files outside workspace requires explicit user approval.'
        }
        break

      case 'run_project_command':
      case 'start_dev_server':
      case 'process_spawn':
        category = 'process'
        requiresApproval = true
        reason = 'Process execution and development server starts require explicit approval.'
        break

      case 'web_search':
      case 'browser_navigate':
      case 'browser_extract':
        category = 'network'
        requiresApproval = false
        reason = 'Read-only web research and browser extraction allowed without mutation.'
        break

      default:
        category = 'process'
        requiresApproval = true
        reason = `Unrecognized action type '${actionType}' defaults to approval-gated process execution.`
        break
    }

    if (!requiresApproval) {
      return {
        allowed: true,
        requiresApproval: false,
        category,
        reason
      }
    }

    // Generate cryptographic approval token and record
    const argsHash = this.computeArgumentsHash(args)
    const approvalId = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 5 * 60 * 1000 // 5 minutes

    const request: ApprovalRequest = {
      id: approvalId,
      actionType,
      category,
      title: payload.title || `Approve: ${actionType}`,
      description: reason,
      explanation: payload.explanation,
      workingDirectory: payload.workingDirectory || workspacePath,
      safetyImpact: payload.safetyImpact,
      workspacePath,
      targetPath,
      command,
      arguments: args,
      argumentsHash: argsHash,
      createdAt: now,
      expiresAt,
      status: 'pending'
    }

    this.pendingApprovals.set(approvalId, request)

    return {
      allowed: false,
      requiresApproval: true,
      category,
      approvalRequest: request,
      reason
    }
  }

  /**
   * Resolves a pending approval request.
   */
  public resolveApproval(approvalId: string, decision: 'granted' | 'denied'): boolean {
    const request = this.pendingApprovals.get(approvalId)
    if (!request) return false

    if (Date.now() > request.expiresAt) {
      request.status = 'expired'
      this.pendingApprovals.delete(approvalId)
      return false
    }

    request.status = decision
    if (decision === 'denied') {
      // Per ADR-004, denied actions are immediately evicted and cannot be silently retried
      this.pendingApprovals.delete(approvalId)
    }
    return true
  }

  /**
   * Verifies whether an approved action's arguments match the exact hash at execution time.
   */
  public verifyApprovedAction(approvalId: string, currentArgs: Record<string, unknown>): boolean {
    const request = this.pendingApprovals.get(approvalId)
    if (!request || request.status !== 'granted') return false

    if (Date.now() > request.expiresAt) {
      request.status = 'expired'
      this.pendingApprovals.delete(approvalId)
      return false
    }

    const currentHash = this.computeArgumentsHash(currentArgs)
    if (currentHash !== request.argumentsHash) {
      // Arguments changed after approval! Invalidate immediately.
      this.pendingApprovals.delete(approvalId)
      return false
    }

    // Single-use token: consume upon verification
    this.pendingApprovals.delete(approvalId)
    return true
  }

  public getPendingApproval(approvalId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(approvalId)
  }

  /**
   * Resolves canonical real path on disk to defeat symlink and junction traversals (SEC-006).
   */
  private resolveRealPath(targetPath: string): string {
    try {
      if (fs.existsSync(targetPath)) {
        return fs.realpathSync.native ? fs.realpathSync.native(targetPath) : fs.realpathSync(targetPath)
      }
      const parentDir = path.dirname(targetPath)
      if (fs.existsSync(parentDir)) {
        const resolvedParent = fs.realpathSync.native
          ? fs.realpathSync.native(parentDir)
          : fs.realpathSync(parentDir)
        return path.join(resolvedParent, path.basename(targetPath))
      }
    } catch {}
    return path.resolve(targetPath)
  }

  public isPathInsideWorkspace(childPath: string, parentWorkspace: string): boolean {
    const realChild = this.resolveRealPath(childPath).toLowerCase()
    const realParent = this.resolveRealPath(parentWorkspace).toLowerCase()
    const relative = path.relative(realParent, realChild)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
  }
}
