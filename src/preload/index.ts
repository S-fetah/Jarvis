import { contextBridge, ipcRenderer } from 'electron'
import {
  JarvisAPI,
  JarvisSettings,
  TaskState,
  TimelineEvent,
  Conversation,
  ModelCatalog,
  MascotState,
  MascotPosition
} from '../shared/types'

const api: JarvisAPI = {
  // Task Control
  submitGoal: (goal: string, workspacePath?: string): Promise<TaskState> => {
    return ipcRenderer.invoke('task:submit-goal', { goal, workspacePath })
  },

  cancelTask: (taskId: string): Promise<void> => {
    return ipcRenderer.invoke('task:cancel', taskId)
  },

  getTaskState: (taskId: string): Promise<TaskState | null> => {
    return ipcRenderer.invoke('task:get-state', taskId)
  },

  // Conversation & Chat History
  getConversations: (): Promise<Conversation[]> => {
    return ipcRenderer.invoke('conversation:list')
  },

  getActiveConversation: (): Promise<Conversation> => {
    return ipcRenderer.invoke('conversation:get-active')
  },

  createConversation: (title?: string): Promise<Conversation> => {
    return ipcRenderer.invoke('conversation:create', title)
  },

  deleteConversation: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('conversation:delete', id)
  },

  sendMessage: (
    conversationId: string,
    content: string,
    workspacePath?: string,
    options?: {
      talkingStyle?: import('../shared/types').TalkingStyle
      taskMode?: import('../shared/types').TaskMode
      thinkingDepth?: import('../shared/types').ThinkingDepth
    }
  ): Promise<{ reply: string; reasoning?: string; task?: TaskState }> => {
    return ipcRenderer.invoke('chat:send', { conversationId, content, workspacePath, ...options })
  },

  // Models & Gateway
  getAvailableModels: (): Promise<ModelCatalog> => {
    return ipcRenderer.invoke('models:list')
  },

  // Approvals (ADR-004)
  resolveApproval: (approvalId: string, decision: 'granted' | 'denied'): Promise<boolean> => {
    return ipcRenderer.invoke('approval:resolve', { approvalId, decision })
  },

  // Events & Subscriptions
  onTaskUpdated: (callback: (state: TaskState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: TaskState): void => callback(state)
    ipcRenderer.on('task:updated', handler)
    return () => ipcRenderer.removeListener('task:updated', handler)
  },

  onTimelineEvent: (callback: (event: TimelineEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, eventData: TimelineEvent): void =>
      callback(eventData)
    ipcRenderer.on('timeline:event', handler)
    return () => ipcRenderer.removeListener('timeline:event', handler)
  },

  onMessageStream: (
    callback: (data: { conversationId: string; chunk: string; type: 'thought' | 'content' }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { conversationId: string; chunk: string; type: 'thought' | 'content' }
    ): void => callback(data)
    ipcRenderer.on('chat:stream', handler)
    return () => ipcRenderer.removeListener('chat:stream', handler)
  },

  // Settings & Workspaces
  getSettings: (): Promise<JarvisSettings> => {
    return ipcRenderer.invoke('settings:get')
  },

  updateSettings: (settings: Partial<JarvisSettings>): Promise<JarvisSettings> => {
    return ipcRenderer.invoke('settings:update', settings)
  },

  setWindowTheme: (theme: import('../shared/types').ThemePreference): Promise<void> => {
    return ipcRenderer.invoke('ui:set-window-theme', theme)
  },

  exportDiagnostics: (): Promise<{ success: boolean; filePath: string }> => {
    return ipcRenderer.invoke('system:export-diagnostics')
  },

  getAutoStart: (): Promise<boolean> => {
    return ipcRenderer.invoke('system:get-autostart')
  },

  setAutoStart: (enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('system:set-autostart', enabled)
  },

  onOpenSettings: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('ui:open-settings', handler)
    return () => ipcRenderer.removeListener('ui:open-settings', handler)
  },

  selectWorkspaceFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:select-folder')
  },

  // System & External Links
  openExternalUrl: (url: string): Promise<void> => {
    return ipcRenderer.invoke('system:open-external-url', url)
  },

  openFreeLLMDashboard: (): Promise<void> => {
    return ipcRenderer.invoke('system:open-freellm-dashboard')
  },

  openPath: (targetPath: string, openWithApp?: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('system:open-path', targetPath, openWithApp)
  },

  showItemInFolder: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('system:show-in-folder', filePath)
  },

  // Process & Development Server Management (Phase 4)
  getActiveProcesses: (): Promise<import('../shared/types').ManagedProcess[]> => {
    return ipcRenderer.invoke('process:list-active')
  },

  stopProcess: (processId: string): Promise<boolean> => {
    return ipcRenderer.invoke('process:stop', processId)
  },

  onProcessUpdated: (
    callback: (process: import('../shared/types').ManagedProcess) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      proc: import('../shared/types').ManagedProcess
    ): void => callback(proc)
    ipcRenderer.on('process:updated', handler)
    return () => ipcRenderer.removeListener('process:updated', handler)
  },

  // Mascot Companion & Quick-Chat (Surfaces A & B)
  getMascotState: (): Promise<MascotState> => {
    return ipcRenderer.invoke('mascot:get-state')
  },

  setMascotState: (state: MascotState): Promise<void> => {
    return ipcRenderer.invoke('mascot:set-state', state)
  },

  getMascotPosition: (): Promise<MascotPosition> => {
    return ipcRenderer.invoke('mascot:get-position')
  },

  moveMascotBy: (deltaX: number, deltaY: number): Promise<void> => {
    return ipcRenderer.invoke('mascot:move-by', { deltaX, deltaY })
  },

  saveMascotPosition: (): Promise<void> => {
    return ipcRenderer.invoke('mascot:save-position')
  },

  toggleQuickChat: (): Promise<void> => {
    return ipcRenderer.invoke('mascot:toggle-quickchat')
  },

  openQuickChat: (): Promise<void> => {
    return ipcRenderer.invoke('mascot:open-quickchat')
  },

  closeQuickChat: (): Promise<void> => {
    return ipcRenderer.invoke('mascot:close-quickchat')
  },

  openMainWindow: (): Promise<void> => {
    return ipcRenderer.invoke('mascot:open-main-window')
  },

  toggleMascotVisibility: (): Promise<boolean> => {
    return ipcRenderer.invoke('mascot:toggle-visibility')
  },

  onMascotStateChanged: (callback: (state: MascotState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: MascotState): void => callback(state)
    ipcRenderer.on('mascot:state-changed', handler)
    return () => ipcRenderer.removeListener('mascot:state-changed', handler)
  },

  onMascotCursorTracking: (callback: (offset: { nx: number; ny: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, offset: { nx: number; ny: number }): void => callback(offset)
    ipcRenderer.on('mascot:cursor-tracking', handler)
    return () => ipcRenderer.removeListener('mascot:cursor-tracking', handler)
  },

  listWorkspaceFiles: (workspacePath?: string): Promise<string[]> => {
    return ipcRenderer.invoke('workspace:list-files', workspacePath)
  },

  readFileData: (filePath: string): Promise<{ success: boolean; dataUrl?: string; filePath?: string; fileName?: string; error?: string }> => {
    return ipcRenderer.invoke('workspace:read-file-data', filePath)
  },

  // Provider Hub & Multi-Provider Engine
  getProviderHubState: (): Promise<import('../shared/types').ProviderHubState> => {
    return ipcRenderer.invoke('providers:get-hub-state')
  },

  updateProviderKey: (providerId: import('../shared/types').ProviderId, apiKey: string, baseUrl?: string): Promise<boolean> => {
    return ipcRenderer.invoke('providers:update-key', { providerId, apiKey, baseUrl })
  },

  setProviderEnabled: (providerId: import('../shared/types').ProviderId, enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('providers:set-enabled', { providerId, enabled })
  },

  testProviderConnection: (providerId: import('../shared/types').ProviderId): Promise<{ success: boolean; latencyMs?: number; models?: string[]; error?: string }> => {
    return ipcRenderer.invoke('providers:test-connection', providerId)
  },

  toggleLocalGatewayServer: (enabled: boolean, port?: number): Promise<{ running: boolean; port: number; error?: string }> => {
    return ipcRenderer.invoke('providers:toggle-local-server', { enabled, port })
  }
}

try {
  contextBridge.exposeInMainWorld('jarvisAPI', api)
} catch (error) {
  console.error('Failed to expose jarvisAPI in preload:', error)
}
