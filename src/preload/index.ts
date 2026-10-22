import { contextBridge, ipcRenderer } from 'electron'
import {
  JarvisAPI,
  JarvisSettings,
  TaskState,
  TimelineEvent,
  Conversation,
  ModelCatalog
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
    workspacePath?: string
  ): Promise<{ reply: string; reasoning?: string; task?: TaskState }> => {
    return ipcRenderer.invoke('chat:send', { conversationId, content, workspacePath })
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

  selectWorkspaceFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:select-folder')
  }
}

try {
  contextBridge.exposeInMainWorld('jarvisAPI', api)
} catch (error) {
  console.error('Failed to expose jarvisAPI in preload:', error)
}
