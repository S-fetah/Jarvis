/**
 * Jarvis Shared Type Definitions
 * Shared across Electron Main, Preload bridge, and React Renderer.
 */

export type PermissionCategory =
  | 'read_in'
  | 'read_out'
  | 'write_in'
  | 'write_out'
  | 'process'
  | 'network'

export type ApprovalStatus = 'pending' | 'granted' | 'denied' | 'expired'

export interface ApprovalRequest {
  id: string
  actionType: string
  category: PermissionCategory
  title: string
  description: string
  workspacePath: string
  targetPath?: string
  command?: string
  arguments: Record<string, unknown>
  argumentsHash: string
  createdAt: number
  expiresAt: number
  status: ApprovalStatus
}

export type TaskStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'waiting_for_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface PlanStep {
  id: string
  title: string
  description: string
  category: PermissionCategory
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  error?: string
}

export interface TaskState {
  id: string
  goal: string
  status: TaskStatus
  workspacePath: string
  activeModel: string
  steps: PlanStep[]
  activeStepId?: string
  currentApproval?: ApprovalRequest
  createdAt: number
  updatedAt: number
}

export interface TimelineEvent {
  id: string
  taskId: string
  timestamp: number
  type: 'log' | 'tool_call' | 'approval_prompt' | 'approval_resolved' | 'artifact_created' | 'error'
  title: string
  details?: string
  category?: PermissionCategory
  metadata?: Record<string, unknown>
}

export interface JarvisSettings {
  gatewayUrl: string
  defaultModel: string
  workspacePaths: string[]
  theme: 'dark' | 'light' | 'system'
  outputDirectory: string
}

export interface JarvisAPI {
  // Task Control
  submitGoal: (goal: string, workspacePath?: string) => Promise<TaskState>
  cancelTask: (taskId: string) => Promise<void>
  getTaskState: (taskId: string) => Promise<TaskState | null>

  // Approvals (ADR-004)
  resolveApproval: (approvalId: string, decision: 'granted' | 'denied') => Promise<boolean>

  // Events & Subscriptions
  onTaskUpdated: (callback: (state: TaskState) => void) => () => void
  onTimelineEvent: (callback: (event: TimelineEvent) => void) => () => void

  // Settings & Workspaces
  getSettings: () => Promise<JarvisSettings>
  updateSettings: (settings: Partial<JarvisSettings>) => Promise<JarvisSettings>
  selectWorkspaceFolder: () => Promise<string | null>
}
