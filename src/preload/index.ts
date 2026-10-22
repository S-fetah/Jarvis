import { contextBridge, ipcRenderer } from 'electron'
import { JarvisAPI, JarvisSettings, TaskState, TimelineEvent } from '../shared/types'

const api: JarvisAPI = {
  submitGoal: (goal: string, workspacePath?: string): Promise<TaskState> => {
    return ipcRenderer.invoke('task:submit-goal', { goal, workspacePath })
  },

  cancelTask: (taskId: string): Promise<void> => {
    return ipcRenderer.invoke('task:cancel', taskId)
  },

  getTaskState: (taskId: string): Promise<TaskState | null> => {
    return ipcRenderer.invoke('task:get-state', taskId)
  },

  resolveApproval: (approvalId: string, decision: 'granted' | 'denied'): Promise<boolean> => {
    return ipcRenderer.invoke('approval:resolve', { approvalId, decision })
  },

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
