import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  FolderOpen,
  Settings,
  ShieldAlert,
  Activity,
  Bot,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  KeyRound,
  Cpu,
  Eye
} from 'lucide-react'
import {
  Conversation,
  ChatMessage,
  TaskState,
  TimelineEvent,
  ApprovalRequest,
  JarvisSettings,
  ModelCatalog,
  TalkingStyle,
  TaskMode,
  ThinkingDepth
} from '../../shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { ThinkingBlock } from './components/ThinkingBlock'
import { ModelSelector } from './components/ModelSelector'
import { SettingsModal } from './components/SettingsModal'
import { RateLimitCard } from './components/RateLimitCard'
import { FreeModelsHubModal } from './components/FreeModelsHubModal'
import { PromptControlsBar } from './components/PromptControlsBar'

export default function App(): React.JSX.Element {
  // --- State Management ---
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputPrompt, setInputPrompt] = useState('')
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
  const [settings, setSettings] = useState<JarvisSettings>({
    gatewayUrl: 'http://127.0.0.1:31415/v1',
    defaultModel: 'gemini-3.6-flash',
    lightMode: false,
    workspacePaths: ['C:\\work\\softwares\\jarvis'],
    theme: 'dark',
    outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
  })
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>({
    all: ['gemini-3.6-flash', 'gemini-flash-lite', 'gpt-4o-mini', 'claude-haiku-4-5'],
    light: ['gemini-flash-lite', 'gemini-3.5-flash-lite', 'gpt-4o-mini', 'claude-haiku-4-5']
  })
  const [taskState, setTaskState] = useState<TaskState | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)

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
    window.jarvisAPI.getSettings().then((s) => {
      setSettings(s)
      if (s.talkingStyle) setTalkingStyle(s.talkingStyle)
      if (s.taskMode) setTaskMode(s.taskMode)
      if (s.thinkingDepth) setThinkingDepth(s.thinkingDepth)
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

    return () => {
      unsubTask()
      unsubTimeline()
      unsubStream()
    }
  }, [])

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
  const handleDeleteConversation = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    if (!window.jarvisAPI) return
    await window.jarvisAPI.deleteConversation(id)

    const remaining = conversations.filter((c) => c.id !== id)
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

  const handleStyleChange = (s: TalkingStyle): void => {
    setTalkingStyle(s)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ talkingStyle: s })
  }

  const handleModeChange = (m: TaskMode): void => {
    setTaskMode(m)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ taskMode: m })
  }

  const handleDepthChange = (d: ThinkingDepth): void => {
    setThinkingDepth(d)
    if (window.jarvisAPI) window.jarvisAPI.updateSettings({ thinkingDepth: d })
  }

  // Send Message / Task Execution
  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string): Promise<void> => {
    if (e) e.preventDefault()
    const promptToSend = (customPrompt || inputPrompt).trim()
    if (!promptToSend || isStreaming) return

    if (!window.jarvisAPI) {
      alert('Jarvis IPC bridge is not connected.')
      return
    }

    const tempUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: promptToSend,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, tempUserMsg])
    setInputPrompt('')
    setIsStreaming(true)
    setCurrentThought('')
    setCurrentReply('')

    try {
      const res = await window.jarvisAPI.sendMessage(
        activeConvId,
        promptToSend,
        settings.workspacePaths[0],
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

  // Resolve ADR-004 Approvals
  const handleResolveApproval = async (
    approval: ApprovalRequest,
    decision: 'granted' | 'denied'
  ): Promise<void> => {
    if (!window.jarvisAPI) return
    await window.jarvisAPI.resolveApproval(approval.id, decision)
  }

  return (
    <div className="flex h-screen bg-jarvis-base text-jarvis-sage overflow-hidden font-sans">
      {/* --- Left Sidebar: Saved Chats & History --- */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-200 bg-jarvis-surface border-r border-jarvis-border flex flex-col flex-shrink-0 z-20 overflow-hidden`}
      >
        <div className="p-3 border-b border-jarvis-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-jarvis-accent to-jarvis-accentGlow flex items-center justify-center font-bold text-jarvis-base shadow-md">
              J
            </div>
            <span className="font-semibold text-xs tracking-wide text-jarvis-ivory">Conversations</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded text-jarvis-muted hover:text-jarvis-ivory hover:bg-jarvis-hover transition"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* + New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-jarvis-accent hover:bg-jarvis-accentHover text-jarvis-base text-xs font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Saved Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-6 text-xs text-jarvis-muted">No chats yet</div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition select-none ${
                    isActive
                      ? 'bg-jarvis-elevated text-jarvis-ivory font-medium border-l-2 border-jarvis-accent'
                      : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-sage'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-jarvis-muted group-hover:text-jarvis-accentGlow transition" />
                    <span className="truncate">{conv.title || 'Conversation'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 border-t border-jarvis-border text-[11px] text-jarvis-muted flex items-center justify-between">
          <span>Local SQLite Storage</span>
          <span className="text-jarvis-accentGlow font-mono">ADR-004 Safe</span>
        </div>
      </aside>

      {/* --- Main Workspace & Chat --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-jarvis-base">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-jarvis-border px-4 flex items-center justify-between bg-jarvis-surface flex-shrink-0">
          <div className="flex items-center space-x-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-jarvis-border text-jarvis-muted hover:text-jarvis-ivory hover:bg-jarvis-hover transition"
                title="Expand conversations sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xs font-semibold tracking-wide text-jarvis-ivory flex items-center space-x-1.5">
                <span>Jarvis for Windows</span>
                {settings.lightMode && (
                  <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-700 text-amber-300 text-[10px] rounded font-mono">
                    ⚡ Light Mode (~1.5s)
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-jarvis-muted">Assistive Autonomy & Local FreeLLMAPI Gateway</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Free Models & Keys Hub Button */}
            <button
              onClick={() => setHubOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-md bg-jarvis-elevated border border-jarvis-borderStrong hover:border-jarvis-accent text-jarvis-sage hover:text-jarvis-ivory transition"
              title="Explore free model providers & get free API keys"
            >
              <KeyRound className="w-3.5 h-3.5 text-jarvis-accentGlow" />
              <span className="hidden sm:inline font-medium">Free Models Hub</span>
            </button>

            {/* Workspace Directory Selector */}
            <button
              onClick={handleSelectWorkspace}
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border border-jarvis-border bg-jarvis-elevated hover:bg-jarvis-hover text-jarvis-sage transition"
              title="Select active workspace directory"
            >
              <FolderOpen className="w-3.5 h-3.5 text-jarvis-accentGlow" />
              <span className="truncate max-w-[150px]">{settings.workspacePaths[0] || 'Select Folder'}</span>
            </button>

            {/* Model Selector & Fast Light Mode Switch */}
            <ModelSelector
              currentModel={settings.defaultModel}
              isLightMode={settings.lightMode}
              catalog={modelCatalog}
              onSelectModel={handleSelectModel}
              onToggleLightMode={handleToggleLightMode}
            />

            {/* Audit Timeline Toggle */}
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className={`p-1.5 rounded border transition ${
                timelineOpen
                  ? 'bg-jarvis-accent/20 border-jarvis-accent text-jarvis-accentGlow'
                  : 'border-jarvis-border bg-jarvis-elevated text-jarvis-muted hover:text-jarvis-ivory'
              }`}
              title="Toggle activity and audit timeline"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>

            {/* Mascot Companion Toggle */}
            <button
              onClick={async () => {
                if (window.jarvisAPI) {
                  const visible = await window.jarvisAPI.toggleMascotVisibility()
                  setSettings((prev) => ({ ...prev, mascotEnabled: visible }))
                }
              }}
              className="p-1.5 rounded border border-jarvis-border bg-jarvis-elevated text-jarvis-accentGlow hover:text-jarvis-ivory hover:border-jarvis-accent transition"
              title="Toggle Floating 3D Owl Mascot on Desktop"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded border border-jarvis-border bg-jarvis-elevated text-jarvis-muted hover:text-jarvis-ivory transition"
              title="Gateway & Key Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Middle Area: Chat View & Optional Timeline Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Chat Messages Section */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {messages.length === 0 && !isStreaming ? (
                /* Welcome Hero & Quick Suggestions */
                <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4 space-y-6">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-jarvis-accent to-jarvis-accentGlow flex items-center justify-center shadow-xl shadow-jarvis-accent/20 text-jarvis-base font-bold">
                      <Sparkles className="w-8 h-8 text-jarvis-base" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-jarvis-ivory">How can Jarvis assist you today?</h2>
                    <p className="text-xs text-jarvis-muted mt-1 max-w-md">
                      Inspect your code, synthesize reports, or execute tasks. Low-risk operations proceed automatically;
                      file changes, external browser launches, and commands require explicit approval.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="grid grid-cols-2 gap-2.5 w-full text-left">
                    <button
                      onClick={() => handleSendMessage(undefined, 'What can you actually do and where is chat history saved?')}
                      className="p-3 rounded-lg bg-jarvis-surface border border-jarvis-border hover:border-jarvis-accent hover:bg-jarvis-elevated transition group text-xs"
                    >
                      <div className="font-semibold text-jarvis-ivory group-hover:text-jarvis-accentGlow">
                        Capabilities & Local Storage
                      </div>
                      <div className="text-[11px] text-jarvis-muted mt-0.5">Where SQLite history is stored</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'open my gmail from chrome')}
                      className="p-3 rounded-lg bg-jarvis-surface border border-jarvis-border hover:border-jarvis-accent hover:bg-jarvis-elevated transition group text-xs"
                    >
                      <div className="font-semibold text-jarvis-ivory group-hover:text-jarvis-accentGlow">
                        Open Gmail in Chrome
                      </div>
                      <div className="text-[11px] text-jarvis-muted mt-0.5">Triggers ADR-004 browser launch approval</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'Check git status and recent commits')}
                      className="p-3 rounded-lg bg-jarvis-surface border border-jarvis-border hover:border-jarvis-accent hover:bg-jarvis-elevated transition group text-xs"
                    >
                      <div className="font-semibold text-jarvis-ivory group-hover:text-jarvis-accentGlow">
                        Git Status & Log
                      </div>
                      <div className="text-[11px] text-jarvis-muted mt-0.5">Inspect branch & staged changes</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'Start the development server with npm run dev')}
                      className="p-3 rounded-lg bg-jarvis-surface border border-jarvis-border hover:border-jarvis-accent hover:bg-jarvis-elevated transition group text-xs"
                    >
                      <div className="font-semibold text-jarvis-ivory group-hover:text-jarvis-accentGlow">
                        Test Dev Server Approval
                      </div>
                      <div className="text-[11px] text-jarvis-muted mt-0.5">Triggers ADR-004 process approval</div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Message Stream */
                messages.map((msg) => {
                  const isUser = msg.role === 'user'

                  // Check if message content is structured rate limit error
                  let isRateLimit = false
                  let rateLimitInfo: { retrySeconds?: number; model?: string } = {}
                  try {
                    const parsed = JSON.parse(msg.content)
                    if (parsed.__rateLimit__) {
                      isRateLimit = true
                      rateLimitInfo = parsed
                    }
                  } catch {
                    if (msg.content.includes('429') && msg.content.includes('rate_limit_exceeded')) {
                      isRateLimit = true
                    }
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-lg bg-jarvis-elevated border border-jarvis-borderStrong flex items-center justify-center flex-shrink-0 mt-1 text-jarvis-accentGlow">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div className={`max-w-[85%] flex flex-col space-y-2`}>
                        {/* 1. SEPARATE THINKING CARD (If reasoning is recorded) */}
                        {!isUser && msg.reasoning && (
                          <ThinkingBlock reasoning={msg.reasoning} isStreaming={false} />
                        )}

                        {/* 2. SEPARATE RESPONSE CARD */}
                        {isUser ? (
                          <div className="bg-jarvis-accent text-jarvis-base font-medium rounded-2xl rounded-tr-none px-4 py-3 shadow-md">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            <div className="mt-1 text-[10px] text-jarvis-base/70 flex justify-end">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        ) : isRateLimit ? (
                          <RateLimitCard
                            initialSeconds={rateLimitInfo.retrySeconds || 75}
                            model={rateLimitInfo.model || settings.defaultModel}
                            onSwitchLightMode={() => handleToggleLightMode(true)}
                            onOpenHub={() => setHubOpen(true)}
                            onRetry={() => {
                              const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
                              if (lastUserMsg) handleSendMessage(undefined, lastUserMsg.content)
                            }}
                          />
                        ) : (
                          <div className="bg-jarvis-surface border border-jarvis-border rounded-2xl rounded-tl-none p-4 shadow-md text-jarvis-ivory space-y-2">
                            <MarkdownRenderer content={msg.content} />

                            <div className="pt-2 border-t border-jarvis-border flex items-center justify-between text-[11px] text-jarvis-muted font-mono">
                              <span className="flex items-center space-x-1.5">
                                <Cpu className="w-3 h-3 text-jarvis-accentGlow" />
                                <span>{settings.lightMode ? 'gemini-flash-lite' : settings.defaultModel}</span>
                              </span>
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="h-7 w-7 rounded-lg bg-jarvis-elevated border border-jarvis-border flex items-center justify-center flex-shrink-0 mt-1 text-jarvis-sage">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* Live Streaming Message Display */}
              {isStreaming && (
                <div className="flex items-start space-x-3 justify-start animate-in fade-in duration-200">
                  <div className="h-7 w-7 rounded-lg bg-jarvis-elevated border border-jarvis-borderStrong flex items-center justify-center flex-shrink-0 mt-1 text-jarvis-accentGlow">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="max-w-[85%] flex flex-col space-y-2 w-full">
                    {/* Live Thinking Block */}
                    {(currentThought || (!currentReply && isStreaming)) && (
                      <ThinkingBlock reasoning={currentThought} isStreaming={!currentReply} />
                    )}

                    {/* Live Response Bubble */}
                    {currentReply ? (
                      <div className="bg-jarvis-surface border border-jarvis-accent/40 rounded-2xl rounded-tl-none p-4 shadow-md text-jarvis-ivory animate-in fade-in duration-150">
                        <MarkdownRenderer content={currentReply} />
                      </div>
                    ) : (
                      <div className="bg-jarvis-surface/80 border border-jarvis-border rounded-xl px-4 py-3 text-jarvis-muted text-xs flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-jarvis-accentGlow animate-ping"></span>
                        <span>Deliberating and preparing response...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-jarvis-border bg-jarvis-surface">
              <PromptControlsBar
                talkingStyle={talkingStyle}
                taskMode={taskMode}
                thinkingDepth={thinkingDepth}
                onStyleChange={handleStyleChange}
                onModeChange={handleModeChange}
                onDepthChange={handleDepthChange}
              />
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={
                    isStreaming
                      ? 'Jarvis is processing...'
                      : settings.lightMode
                        ? 'Ask Jarvis (⚡ Fast Light Mode active)...'
                        : 'Ask Jarvis or enter an instruction (e.g. "open my gmail from chrome")...'
                  }
                  disabled={isStreaming}
                  className="flex-1 bg-jarvis-base border border-jarvis-border rounded-lg px-3.5 py-2.5 text-sm text-jarvis-ivory placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent transition disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isStreaming}
                  className="px-4 py-2.5 bg-jarvis-accent hover:bg-jarvis-accentHover disabled:opacity-40 text-jarvis-base font-bold rounded-lg text-sm flex items-center space-x-1.5 transition shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>

          {/* Optional Right Column: Audit Timeline & Plan */}
          {timelineOpen && (
            <div className="w-80 border-l border-jarvis-border bg-jarvis-surface flex flex-col min-h-0">
              <div className="p-3 border-b border-jarvis-border flex items-center justify-between">
                <span className="text-xs font-semibold text-jarvis-sage uppercase tracking-wider">
                  Audit Timeline
                </span>
                <span className="text-[10px] text-jarvis-muted font-mono">
                  {timelineEvents.length} events
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-jarvis-muted font-sans">
                    No timeline logs recorded yet.
                  </div>
                ) : (
                  timelineEvents.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded bg-jarvis-base border border-jarvis-border">
                      <div className="flex items-center justify-between text-[10px] text-jarvis-muted mb-1">
                        <span className="font-semibold text-jarvis-ivory truncate">{ev.title}</span>
                        <span className="text-jarvis-muted">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      {ev.details && (
                        <p className="text-jarvis-sage text-[11px] leading-relaxed break-words font-sans">
                          {ev.details}
                        </p>
                      )}
                      {ev.type === 'artifact_created' && (
                        <div className="mt-2 pt-1.5 border-t border-jarvis-border/40 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const match = ev.details?.match(/`([^`]+)`/)
                              const target = match ? match[1] : settings.outputDirectory
                              window.jarvisAPI?.openPath(target)
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-jarvis-surface hover:bg-jarvis-border text-jarvis-accent border border-jarvis-border flex items-center space-x-1 transition shadow-sm"
                            title="Reveal in Windows File Explorer"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Reveal in Explorer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- ADR-004 Gated Process Approval Modal --- */}
      {taskState?.currentApproval && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-jarvis-surface border border-amber-500/60 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-jarvis-ivory">
                    {taskState.currentApproval.title || 'Action Requires Approval'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/80 border border-amber-700 text-amber-300">
                    {taskState.currentApproval.category}
                  </span>
                </div>
                <p className="text-xs text-jarvis-muted mt-0.5">
                  ADR-004 Policy Engine: Assistive Autonomy requires explicit approval.
                </p>
              </div>
            </div>

            <div className="bg-jarvis-base rounded-lg p-3.5 border border-jarvis-border space-y-3 text-xs">
              {/* Command Box */}
              {taskState.currentApproval.command && (
                <div>
                  <span className="text-[11px] font-semibold text-jarvis-muted block mb-1 uppercase tracking-wider">
                    Exact Command to Execute:
                  </span>
                  <div className="bg-[#05080f] p-2.5 rounded border border-jarvis-border font-mono text-jarvis-accentGlow text-xs flex items-center justify-between">
                    <code>{taskState.currentApproval.command}</code>
                    <span className="text-[10px] text-jarvis-muted font-sans">powershell / system</span>
                  </div>
                </div>
              )}

              {/* Target Directory */}
              <div>
                <span className="text-[11px] font-semibold text-jarvis-muted block mb-0.5 uppercase tracking-wider">
                  Target Directory:
                </span>
                <code className="text-jarvis-sage font-mono text-[11px] break-all">
                  {taskState.currentApproval.workingDirectory || taskState.currentApproval.workspacePath}
                </code>
              </div>

              {/* Purpose */}
              {taskState.currentApproval.explanation && (
                <div className="p-2.5 rounded bg-jarvis-elevated border border-jarvis-border text-jarvis-sage text-xs">
                  <strong className="block text-jarvis-accentGlow font-semibold mb-0.5">Purpose:</strong>
                  {taskState.currentApproval.explanation}
                </div>
              )}

              {/* Safety Impact */}
              {taskState.currentApproval.safetyImpact && (
                <div className="p-2.5 rounded bg-jarvis-elevated/60 border border-jarvis-border text-jarvis-sage text-[11px]">
                  <strong className="block text-jarvis-ivory font-semibold mb-0.5">Safety & Process Impact:</strong>
                  {taskState.currentApproval.safetyImpact}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-1">
              <button
                onClick={() => handleResolveApproval(taskState.currentApproval!, 'denied')}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-700/60 rounded-lg text-xs font-semibold transition"
              >
                Deny Action
              </button>
              <button
                onClick={() => handleResolveApproval(taskState.currentApproval!, 'granted')}
                className="px-4 py-2 bg-jarvis-accent hover:bg-jarvis-accentHover text-jarvis-base rounded-lg text-xs font-bold shadow-lg shadow-jarvis-accent/20 transition"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Settings Modal --- */}
      <SettingsModal
        settings={settings}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={async (updated) => {
          if (!window.jarvisAPI) return
          const newSettings = await window.jarvisAPI.updateSettings(updated)
          setSettings(newSettings)
          const catalog = await window.jarvisAPI.getAvailableModels()
          setModelCatalog(catalog)
        }}
      />

      {/* --- Free Models & Providers Hub Modal --- */}
      <FreeModelsHubModal
        isOpen={hubOpen}
        onClose={() => setHubOpen(false)}
        onRefreshCatalog={handleRefreshCatalog}
      />
    </div>
  )
}
