import React, { useEffect, useRef, useState } from 'react'
import type {
  ApprovalRequest,
  ChatMessage,
  Conversation,
  JarvisSettings,
  ManagedProcess,
  ModelCatalog,
  TaskMode,
  TaskState,
  TalkingStyle,
  ThemePreference,
  ThinkingDepth,
  TimelineEvent
} from '../../shared/types'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/layout/Sidebar'
import { ChatHeader } from './components/chat/ChatHeader'
import { WelcomeView } from './components/chat/WelcomeView'
import { MessageList } from './components/chat/MessageList'
import { Composer } from './components/chat/Composer'
import { ProcessStrip } from './components/chat/ProcessStrip'
import { PlanCard } from './components/chat/PlanCard'
import { EvidenceRail } from './components/activity/EvidenceRail'
import { ApprovalDialog } from './components/approval/ApprovalDialog'
import { SettingsModal } from './components/SettingsModal'
import { FreeModelsHubModal } from './components/FreeModelsHubModal'
import { TooltipProvider } from './components/ui'
import { applyTheme, cacheTheme, onSystemThemeChange, readCachedTheme } from './lib/theme'
import { basename } from './lib/format'

export default function App(): React.JSX.Element {
  // --- State Management ---
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentThought, setCurrentThought] = useState('')
  const [currentReply, setCurrentReply] = useState('')

  // Assistant Mode & Style Configuration
  const [talkingStyle, setTalkingStyle] = useState<TalkingStyle>('balanced')
  const [taskMode, setTaskMode] = useState<TaskMode>('chat')
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('standard')

  // UI Modals & Drawers
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)

  // App Settings & Models
  const [theme, setTheme] = useState<ThemePreference>(() => readCachedTheme())
  const [isDark, setIsDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark')
  )
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [settings, setSettings] = useState<JarvisSettings>({
    gatewayUrl: 'http://127.0.0.1:31415/v1',
    defaultModel: 'auto',
    lightMode: false,
    workspacePaths: ['C:\\work\\softwares\\jarvis'],
    theme: 'system',
    outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
  })
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>({
    all: ['gemini-3.6-flash', 'gemini-flash-lite', 'gpt-4o-mini', 'claude-haiku-4-5'],
    light: ['gemini-flash-lite', 'gemini-3.5-flash-lite', 'gpt-4o-mini', 'claude-haiku-4-5']
  })
  const [taskState, setTaskState] = useState<TaskState | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [activeProcesses, setActiveProcesses] = useState<ManagedProcess[]>([])
  const [expandedLogsProcessId, setExpandedLogsProcessId] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find((conversation) => conversation.id === activeConvId)
  const workspacePath = settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis'

  // Apply the preference (and keep following Windows when set to system).
  useEffect(() => {
    const effective = applyTheme(theme)
    setIsDark(effective === 'dark')

    if (theme !== 'system') return
    return onSystemThemeChange(() => {
      const next = applyTheme('system')
      setIsDark(next === 'dark')
    })
  }, [theme])

  // Auto-scroll chat to bottom
  const scrollToBottom = (): void => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentReply, currentThought])

  // Initial Load & IPC Subscriptions
  useEffect(() => {
    if (!window.jarvisAPI) return

    // 1. Load Settings
    window.jarvisAPI.getSettings().then((loaded) => {
      setSettings(loaded)
      const initialTheme: ThemePreference = loaded.theme || 'system'
      setTheme(initialTheme)
      cacheTheme(initialTheme)
      if (loaded.talkingStyle) setTalkingStyle(loaded.talkingStyle)
      if (loaded.taskMode) setTaskMode(loaded.taskMode)
      if (loaded.thinkingDepth) setThinkingDepth(loaded.thinkingDepth)
    })

    // 2. Load Models
    window.jarvisAPI.getAvailableModels().then((catalog) => {
      setModelCatalog(catalog)
    })

    // 3. Load Conversations
    window.jarvisAPI.getConversations().then((list) => {
      setConversations(list)
      if (list.length > 0) {
        setActiveConvId(list[0].id)
        setMessages(list[0].messages || [])
      } else {
        window.jarvisAPI.createConversation('Jarvis General Chat').then((newConv) => {
          setConversations([newConv])
          setActiveConvId(newConv.id)
          setMessages([])
        })
      }
    })

    // 4. Subscriptions
    const unsubTask = window.jarvisAPI.onTaskUpdated((state) => {
      setTaskState(state)
    })

    const unsubTimeline = window.jarvisAPI.onTimelineEvent((event) => {
      setTimelineEvents((prev) => [...prev, event])
    })

    const unsubStream = window.jarvisAPI.onMessageStream((data) => {
      if (data.type === 'thought') {
        setCurrentThought((prev) => prev + data.chunk)
      } else {
        setCurrentReply((prev) => prev + data.chunk)
      }
    })

    // 5. Managed Processes (Phase 4)
    if (window.jarvisAPI.getActiveProcesses) {
      window.jarvisAPI.getActiveProcesses().then((procs) => {
        setActiveProcesses(procs.filter((proc) => proc.status === 'running' || proc.status === 'starting'))
      })
    }

    const unsubProcess = window.jarvisAPI.onProcessUpdated
      ? window.jarvisAPI.onProcessUpdated((proc) => {
          setActiveProcesses((prev) => {
            const index = prev.findIndex((p) => p.id === proc.id)
            if (proc.status === 'stopped' || proc.status === 'failed') {
              return prev.filter((p) => p.id !== proc.id)
            }
            if (index >= 0) {
              const updated = [...prev]
              updated[index] = proc
              return updated
            }
            return [...prev, proc]
          })
        })
      : () => {}

    const unsubOpenSettings = window.jarvisAPI?.onOpenSettings
      ? window.jarvisAPI.onOpenSettings(() => setSettingsOpen(true))
      : () => {}

    return () => {
      unsubTask()
      unsubTimeline()
      unsubStream()
      unsubProcess()
      unsubOpenSettings()
    }
  }, [])

  // Terminate Managed Process (Dev Server)
  const handleStopProcess = async (processId: string): Promise<void> => {
    if (!window.jarvisAPI?.stopProcess) return
    await window.jarvisAPI.stopProcess(processId)
  }

  // Switch Conversation
  const handleSelectConversation = (conv: Conversation): void => {
    setActiveConvId(conv.id)
    setMessages(conv.messages || [])
    setCurrentThought('')
    setCurrentReply('')
  }

  // Create New Chat
  const handleNewChat = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const newConv = await window.jarvisAPI.createConversation('New Chat')
    setConversations((prev) => [newConv, ...prev])
    setActiveConvId(newConv.id)
    setMessages([])
    setCurrentThought('')
    setCurrentReply('')
  }

  // Delete Conversation
  const handleDeleteConversation = async (event: React.MouseEvent, id: string): Promise<void> => {
    event.stopPropagation()
    if (!window.jarvisAPI) return
    await window.jarvisAPI.deleteConversation(id)

    const remaining = conversations.filter((conversation) => conversation.id !== id)
    setConversations(remaining)

    if (activeConvId === id) {
      if (remaining.length > 0) {
        handleSelectConversation(remaining[0])
      } else {
        const fresh = await window.jarvisAPI.createConversation('Jarvis General Chat')
        setConversations([fresh])
        handleSelectConversation(fresh)
      }
    }
  }

  const handleStyleChange = (style: TalkingStyle): void => {
    setTalkingStyle(style)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ talkingStyle: style })
  }

  const handleModeChange = (mode: TaskMode): void => {
    setTaskMode(mode)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ taskMode: mode })
  }

  const handleDepthChange = (depth: ThinkingDepth): void => {
    setThinkingDepth(depth)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ thinkingDepth: depth })
  }

  // Send Message / Task Execution
  const handleSendMessage = async (promptToSend?: string): Promise<void> => {
    const prompt = (promptToSend || '').trim()
    if (!prompt || isStreaming) return

    if (!window.jarvisAPI) {
      alert('Jarvis IPC bridge is not connected.')
      return
    }

    const tempUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, tempUserMsg])
    setIsStreaming(true)
    setCurrentThought('')
    setCurrentReply('')

    try {
      const res = await window.jarvisAPI.sendMessage(
        activeConvId,
        prompt,
        workspacePath,
        { talkingStyle, taskMode, thinkingDepth }
      )

      const finalAssistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        reasoning: res.reasoning,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, finalAssistantMsg])

      const updatedList = await window.jarvisAPI.getConversations()
      setConversations(updatedList)
    } catch (err: any) {
      console.error('[Jarvis] Send message error:', err)
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** ${err?.message || 'Failed to communicate with model gateway.'}`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsStreaming(false)
      setCurrentThought('')
      setCurrentReply('')
    }
  }

  // Model Selection
  const handleSelectModel = async (model: string): Promise<void> => {
    if (!window.jarvisAPI) return
    const updated = await window.jarvisAPI.updateSettings({ defaultModel: model, lightMode: false })
    setSettings(updated)
  }

  // Toggle Light Mode
  const handleToggleLightMode = async (enabled: boolean): Promise<void> => {
    if (!window.jarvisAPI) return
    const updated = await window.jarvisAPI.updateSettings({ lightMode: enabled })
    setSettings(updated)
  }

  // Workspace Directory Picker
  const handleSelectWorkspace = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const selected = await window.jarvisAPI.selectWorkspaceFolder()
    if (selected) {
      const updated = await window.jarvisAPI.updateSettings({ workspacePaths: [selected] })
      setSettings(updated)
    }
  }

  // Refresh Catalog
  const handleRefreshCatalog = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const catalog = await window.jarvisAPI.getAvailableModels()
    setModelCatalog(catalog)
  }

  // Copy Message to Clipboard
  const handleCopyMessage = (id: string, text: string): void => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedMessageId(id)
    window.setTimeout(() => setCopiedMessageId(null), 2000)
  }

  // Toggle Theme (Light / Dark) — the three-way preference lives in Settings.
  const handleToggleTheme = async (): Promise<void> => {
    const nextTheme: ThemePreference = isDark ? 'light' : 'dark'
    setTheme(nextTheme)
    if (window.jarvisAPI) {
      const updated = await window.jarvisAPI.updateSettings({ theme: nextTheme })
      setSettings(updated)
    }
  }

  const handleToggleMascot = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const visible = await window.jarvisAPI.toggleMascotVisibility()
    setSettings((prev) => ({ ...prev, mascotEnabled: visible }))
  }

  // Resolve ADR-004 Approvals
  const handleResolveApproval = async (
    approval: ApprovalRequest,
    decision: 'granted' | 'denied'
  ): Promise<void> => {
    if (!window.jarvisAPI) return
    await window.jarvisAPI.resolveApproval(approval.id, decision)
  }

  const handleSaveSettings = async (updated: Partial<JarvisSettings>): Promise<void> => {
    if (!window.jarvisAPI) return
    const newSettings = await window.jarvisAPI.updateSettings(updated)
    setSettings(newSettings)
    if (newSettings.theme) setTheme(newSettings.theme)
    const catalog = await window.jarvisAPI.getAvailableModels()
    setModelCatalog(catalog)
  }

  const handleRetryLast = (): void => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (lastUserMessage) void handleSendMessage(lastUserMessage.content)
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-jarvis-base font-sans text-jarvis-sage">
        <TitleBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          conversationTitle={activeConversation?.title || 'New conversation'}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          mascotEnabled={settings.mascotEnabled !== false}
          onToggleMascot={handleToggleMascot}
          onOpenHub={() => setHubOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          <Sidebar
            open={sidebarOpen}
            conversations={conversations}
            activeConvId={activeConvId}
            workspacePath={workspacePath}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onSelectWorkspace={handleSelectWorkspace}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <ChatHeader
              title={activeConversation?.title || 'New conversation'}
              workspacePath={workspacePath}
              onSelectWorkspace={handleSelectWorkspace}
              currentModel={settings.defaultModel}
              lightMode={settings.lightMode}
              catalog={modelCatalog}
              onSelectModel={handleSelectModel}
              onToggleLightMode={handleToggleLightMode}
              timelineOpen={timelineOpen}
              onToggleTimeline={() => setTimelineOpen((value) => !value)}
              eventCount={timelineEvents.length}
              taskStatus={taskState?.status}
            />

            <ProcessStrip
              processes={activeProcesses}
              expandedLogsProcessId={expandedLogsProcessId}
              onToggleLogs={(id) =>
                setExpandedLogsProcessId((current) => (current === id ? null : id))
              }
              onStopProcess={handleStopProcess}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto px-5 py-6">
                  <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col">
                    {taskState && taskState.steps.length > 0 && (
                      <div className="mb-5">
                        <PlanCard taskState={taskState} />
                      </div>
                    )}

                    {messages.length === 0 && !isStreaming ? (
                      <WelcomeView
                        onSuggestion={(prompt) => void handleSendMessage(prompt)}
                        workspaceName={basename(workspacePath)}
                      />
                    ) : (
                      <MessageList
                        messages={messages}
                        isStreaming={isStreaming}
                        currentThought={currentThought}
                        currentReply={currentReply}
                        model={settings.defaultModel}
                        lightMode={settings.lightMode}
                        copiedMessageId={copiedMessageId}
                        onCopyMessage={handleCopyMessage}
                        onSwitchLightMode={() => void handleToggleLightMode(true)}
                        onOpenHub={() => setHubOpen(true)}
                        onRetry={handleRetryLast}
                      />
                    )}

                    <div ref={chatEndRef} />
                  </div>
                </div>

                <Composer
                  onSubmit={handleSendMessage}
                  isStreaming={isStreaming}
                  lightMode={settings.lightMode}
                  model={settings.defaultModel}
                  talkingStyle={talkingStyle}
                  taskMode={taskMode}
                  thinkingDepth={thinkingDepth}
                  onStyleChange={handleStyleChange}
                  onModeChange={handleModeChange}
                  onDepthChange={handleDepthChange}
                  onToggleLightMode={() => void handleToggleLightMode(!settings.lightMode)}
                />
              </div>

              {timelineOpen && (
                <EvidenceRail
                  timelineEvents={timelineEvents}
                  taskState={taskState}
                  outputDirectory={settings.outputDirectory}
                  onClose={() => setTimelineOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <ApprovalDialog approval={taskState?.currentApproval || null} onResolve={handleResolveApproval} />

        <SettingsModal
          settings={settings}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />

        <FreeModelsHubModal
          isOpen={hubOpen}
          onClose={() => setHubOpen(false)}
          onRefreshCatalog={handleRefreshCatalog}
        />
      </div>
    </TooltipProvider>
  )
}
