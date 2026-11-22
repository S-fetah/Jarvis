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
} from '@jarvis/protocol'

const api: JarvisAPI = {
  // Task Control
  submitGoal: (goal: string, workspacePath?: string): Promise<TaskState> => {
    return ipcRenderer.invoke('task:submit-goal', { goal, workspacePath })
  },

  cancelTask: (taskId: string): Promise<void> => {
    return ipcRenderer.invoke('task:cancel', taskId)
  },

  cancelChat: (conversationId: string): Promise<boolean> => {
    return ipcRenderer.invoke('chat:cancel', conversationId)
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

  renameConversation: (id: string, title: string): Promise<boolean> => {
    return ipcRenderer.invoke('conversation:rename', { id, title })
  },

  sendMessage: (
    conversationId: string,
    content: string,
    workspacePath?: string,
    options?: {
      talkingStyle?: import('@jarvis/protocol').TalkingStyle
      taskMode?: import('@jarvis/protocol').TaskMode
      thinkingDepth?: import('@jarvis/protocol').ThinkingDepth
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

  setWindowTheme: (theme: import('@jarvis/protocol').ThemePreference): Promise<void> => {
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

  selectSqliteStorageFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('storage:select-sqlite-folder')
  },

  setSqliteStorageFolder: (
    folderPath: string | null
  ): Promise<{
    success: boolean
    sqliteStoragePath?: string
    mode?: 'migrated' | 'loaded_existing' | 'unchanged'
    error?: string
  }> => {
    return ipcRenderer.invoke('storage:set-sqlite-folder', folderPath)
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
  getActiveProcesses: (): Promise<import('@jarvis/protocol').ManagedProcess[]> => {
    return ipcRenderer.invoke('process:list-active')
  },

  stopProcess: (processId: string): Promise<boolean> => {
    return ipcRenderer.invoke('process:stop', processId)
  },

  onProcessUpdated: (
    callback: (process: import('@jarvis/protocol').ManagedProcess) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      proc: import('@jarvis/protocol').ManagedProcess
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
  getProviderHubState: (): Promise<import('@jarvis/protocol').ProviderHubState> => {
    return ipcRenderer.invoke('providers:get-hub-state')
  },

  updateProviderKey: (providerId: import('@jarvis/protocol').ProviderId, apiKey: string, baseUrl?: string): Promise<boolean> => {
    return ipcRenderer.invoke('providers:update-key', { providerId, apiKey, baseUrl })
  },

  setProviderEnabled: (providerId: import('@jarvis/protocol').ProviderId, enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('providers:set-enabled', { providerId, enabled })
  },

  testProviderConnection: (providerId: import('@jarvis/protocol').ProviderId): Promise<{ success: boolean; latencyMs?: number; models?: string[]; error?: string }> => {
    return ipcRenderer.invoke('providers:test-connection', providerId)
  },

  toggleLocalGatewayServer: (enabled: boolean, port?: number): Promise<{ running: boolean; port: number; error?: string }> => {
    return ipcRenderer.invoke('providers:toggle-local-server', { enabled, port })
  },

  importFromFreeLLMAPI: (): Promise<{ success: boolean; imported: string[]; error?: string }> => {
    return ipcRenderer.invoke('providers:import-freellmapi')
  },

  // Dedicated Standalone Settings & Config Window
  openSettingsWindow: (tab?: string): Promise<void> => {
    return ipcRenderer.invoke('settings:open-window', tab)
  },

  closeSettingsWindow: (): Promise<void> => {
    return ipcRenderer.invoke('settings:close-window')
  },

  onNavigateSettingsTab: (callback: (tab: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tab: string): void => callback(tab)
    ipcRenderer.on('settings:navigate-tab', handler)
    return () => ipcRenderer.removeListener('settings:navigate-tab', handler)
  },

  getUserMemory: (workspacePath?: string): Promise<{ filePath: string; rawMarkdown: string; memory: any }> => {
    return ipcRenderer.invoke('memory:get', workspacePath)
  },

  saveUserMemory: (markdown: string, workspacePath?: string): Promise<boolean> => {
    return ipcRenderer.invoke('memory:save', { markdown, workspacePath })
  },

  // Voice System API
  voiceGetState: (): Promise<string> => {
    return ipcRenderer.invoke('voice:get-state')
  },

  voiceTranscribe: (audio: {
    data: Uint8Array | number[]
    sampleRateHz: number
    channels: 1 | 2
    format: 'pcm16' | 'wav' | 'webm' | 'ogg'
  }): Promise<{ text: string; language?: string; durationMs?: number }> => {
    return ipcRenderer.invoke('voice:transcribe', audio)
  },

  voiceSynthesize: (
    text: string,
    options?: {
      voice?: string
      speed?: number
      language?: string
      speakerWav?: string
      providerId?: string
      spokenIntroOnly?: boolean
      bypassCache?: boolean
    }
  ): Promise<{
    data: Uint8Array | number[]
    sampleRateHz: number
    format: string
    durationMs?: number
    providerId?: string
    voice?: string
    cached?: boolean
  }> => {
    return ipcRenderer.invoke('voice:synthesize', { text, options })
  },

  voiceClearAudioCache: (): Promise<{ clearedCount: number; freedBytes: number }> => {
    return ipcRenderer.invoke('voice:clear-audio-cache')
  },

  voiceGetAudioCacheStats: (): Promise<{ entryCount: number; totalBytes: number; cacheDir: string }> => {
    return ipcRenderer.invoke('voice:get-audio-cache-stats')
  },

  voiceInterrupt: (): Promise<boolean> => {
    return ipcRenderer.invoke('voice:interrupt')
  },

  voiceProcessChunk: (chunk: Int16Array | number[]): Promise<boolean> => {
    return ipcRenderer.invoke('voice:process-chunk', chunk)
  },

  voiceGetConfig: (): Promise<any> => {
    return ipcRenderer.invoke('voice:get-config')
  },

  voiceUpdateConfig: (config: any): Promise<any> => {
    return ipcRenderer.invoke('voice:update-config', config)
  },

  voiceListProfiles: (): Promise<any> => {
    return ipcRenderer.invoke('voice:list-profiles')
  },

  voiceCreateProfile: (
    name: string,
    wavBase64: string,
    description?: string,
    options?: { gender?: 'female' | 'male' | 'neutral'; baseVoice?: string }
  ): Promise<any> => {
    return ipcRenderer.invoke('voice:create-profile', {
      name,
      wavBase64,
      description,
      gender: options?.gender,
      baseVoice: options?.baseVoice
    })
  },

  voiceDeleteProfile: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('voice:delete-profile', id)
  },

  onVoiceEvent: (callback: (event: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, voiceEvt: any): void => callback(voiceEvt)
    ipcRenderer.on('voice:event', handler)
    return () => ipcRenderer.removeListener('voice:event', handler)
  }
}

try {
  contextBridge.exposeInMainWorld('jarvisAPI', api)
} catch (error) {
  console.error('Failed to expose jarvisAPI in preload:', error)
}
