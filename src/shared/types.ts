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
  explanation?: string
  workingDirectory?: string
  safetyImpact?: string
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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export interface JarvisSettings {
  gatewayUrl: string
  apiKey?: string
  hasApiKey?: boolean
  defaultModel: string
  lightMode: boolean
  mascotEnabled?: boolean
  reduceMotion?: boolean
  workspacePaths: string[]
  theme: 'dark' | 'light' | 'system'
  outputDirectory: string
}

export type MascotState =
  | 'loading'
  | 'idle'
  | 'attention'
  | 'thinking'
  | 'working'
  | 'needsApproval'
  | 'completed'
  | 'error'
  | 'hidden'

export interface MascotPosition {
  x: number
  y: number
}

export interface ModelCatalog {
  all: string[]
  light: string[]
}

export interface JarvisAPI {
  // Task Control
  submitGoal: (goal: string, workspacePath?: string) => Promise<TaskState>
  cancelTask: (taskId: string) => Promise<void>
  getTaskState: (taskId: string) => Promise<TaskState | null>

  // Conversation & Chat History
  getConversations: () => Promise<Conversation[]>
  getActiveConversation: () => Promise<Conversation>
  createConversation: (title?: string) => Promise<Conversation>
  deleteConversation: (id: string) => Promise<boolean>
  sendMessage: (
    conversationId: string,
    content: string,
    workspacePath?: string
  ) => Promise<{ reply: string; reasoning?: string; task?: TaskState }>

  // Models & Gateway
  getAvailableModels: () => Promise<ModelCatalog>

  // Approvals (ADR-004)
  resolveApproval: (approvalId: string, decision: 'granted' | 'denied') => Promise<boolean>

  // Events & Subscriptions
  onTaskUpdated: (callback: (state: TaskState) => void) => () => void
  onTimelineEvent: (callback: (event: TimelineEvent) => void) => () => void
  onMessageStream: (
    callback: (data: { conversationId: string; chunk: string; type: 'thought' | 'content' }) => void
  ) => () => void

  // Settings & Workspaces
  getSettings: () => Promise<JarvisSettings>
  updateSettings: (settings: Partial<JarvisSettings>) => Promise<JarvisSettings>
  selectWorkspaceFolder: () => Promise<string | null>

  // System & External Links
  openExternalUrl: (url: string) => Promise<void>
  openFreeLLMDashboard: () => Promise<void>

  // Mascot Companion & Quick-Chat (Surfaces A & B)
  getMascotState: () => Promise<MascotState>
  setMascotState: (state: MascotState) => Promise<void>
  getMascotPosition: () => Promise<MascotPosition>
  moveMascotBy: (deltaX: number, deltaY: number) => Promise<void>
  saveMascotPosition: () => Promise<void>
  toggleQuickChat: () => Promise<void>
  openQuickChat: () => Promise<void>
  closeQuickChat: () => Promise<void>
  openMainWindow: () => Promise<void>
  toggleMascotVisibility: () => Promise<boolean>
  onMascotStateChanged: (callback: (state: MascotState) => void) => () => void
  onMascotCursorTracking?: (callback: (offset: { nx: number; ny: number }) => void) => () => void
}
