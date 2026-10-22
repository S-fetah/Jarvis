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
  Sparkles
} from 'lucide-react'
import {
  Conversation,
  ChatMessage,
  TaskState,
  TimelineEvent,
  ApprovalRequest,
  JarvisSettings,
  ModelCatalog
} from '../../shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { ThinkingBlock } from './components/ThinkingBlock'
import { ModelSelector } from './components/ModelSelector'
import { SettingsModal } from './components/SettingsModal'

export default function App(): React.JSX.Element {
  // --- State Management ---
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputPrompt, setInputPrompt] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentThought, setCurrentThought] = useState('')
  const [currentReply, setCurrentReply] = useState('')

  // UI Panels
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // App Settings & Tasks
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
        // Create initial conversation
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
      // Stream live response from LLM
      const res = await window.jarvisAPI.sendMessage(
        activeConvId,
        promptToSend,
        settings.workspacePaths[0]
      )

      // Add finalized assistant message to state
      const finalAssistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        reasoning: res.reasoning,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, finalAssistantMsg])

      // Refresh conversations list to update titles/timestamps
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

  // Resolve ADR-004 Approvals
  const handleResolveApproval = async (
    approval: ApprovalRequest,
    decision: 'granted' | 'denied'
  ): Promise<void> => {
    if (!window.jarvisAPI) return
    await window.jarvisAPI.resolveApproval(approval.id, decision)
  }

  return (
    <div className="flex h-screen bg-[#0d1117] text-slate-200 overflow-hidden font-sans">
      {/* --- Left Sidebar: Saved Chats & History --- */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-200 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0 z-20 overflow-hidden`}
      >
        <div className="p-3 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
              J
            </div>
            <span className="font-semibold text-xs tracking-wide text-white">Conversations</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* + New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Saved Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">No chats yet</div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition select-none ${
                    isActive
                      ? 'bg-[#21262d] text-white font-medium border-l-2 border-blue-500'
                      : 'text-slate-400 hover:bg-[#1f242c] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-400 transition" />
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
        <div className="p-2.5 border-t border-[#30363d] text-[11px] text-slate-500 flex items-center justify-between">
          <span>Local SQLite Storage</span>
          <span className="text-emerald-400 font-mono">ADR-004 Safe</span>
        </div>
      </aside>

      {/* --- Main Workspace & Chat --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22] flex-shrink-0">
          <div className="flex items-center space-x-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-[#30363d] text-slate-400 hover:text-white hover:bg-[#21262d] transition"
                title="Expand conversations sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xs font-semibold tracking-wide text-white flex items-center space-x-1.5">
                <span>Jarvis for Windows</span>
                {settings.lightMode && (
                  <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-700 text-amber-300 text-[10px] rounded font-mono">
                    ⚡ Light Mode (~1.5s)
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-400">Assistive Autonomy & Local FreeLLMAPI Gateway</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Workspace Directory Selector */}
            <button
              onClick={handleSelectWorkspace}
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] transition"
              title="Select active workspace directory"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[160px]">{settings.workspacePaths[0] || 'Select Folder'}</span>
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
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'border-[#30363d] bg-[#21262d] text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle activity and audit timeline"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded border border-[#30363d] bg-[#21262d] text-slate-400 hover:text-slate-200 transition"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !isStreaming ? (
                /* Welcome Hero & Quick Suggestions */
                <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4 space-y-6">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-900/30">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">How can Jarvis assist you today?</h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      Inspect your code, synthesize reports, or execute tasks. Low-risk operations proceed automatically;
                      file changes and commands require explicit approval.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="grid grid-cols-2 gap-2.5 w-full text-left">
                    <button
                      onClick={() => handleSendMessage(undefined, 'Who are you and what models are available?')}
                      className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-blue-500/60 hover:bg-[#1c2128] transition group text-xs"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-blue-300">
                        Who are you & models?
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Explore capabilities & models</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'Inspect project structure and summarize findings')}
                      className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-blue-500/60 hover:bg-[#1c2128] transition group text-xs"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-blue-300">
                        Inspect Workspace
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Safe read-only codebase review</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'Check git status and recent commits')}
                      className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-blue-500/60 hover:bg-[#1c2128] transition group text-xs"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-blue-300">
                        Git Status & Log
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Inspect branch & staged changes</div>
                    </button>

                    <button
                      onClick={() => handleSendMessage(undefined, 'Start the development server with npm run dev')}
                      className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-blue-500/60 hover:bg-[#1c2128] transition group text-xs"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-blue-300">
                        Test Approval Gating
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Triggers ADR-004 process approval</div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Message Bubbles */
                messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-lg bg-blue-600/30 border border-blue-500/50 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-300">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-xl p-3.5 ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-[#161b22] border border-[#30363d] text-slate-200 rounded-tl-none shadow-md'
                        }`}
                      >
                        {/* Thinking Block (If present) */}
                        {!isUser && msg.reasoning && (
                          <ThinkingBlock reasoning={msg.reasoning} isStreaming={false} />
                        )}

                        {/* Clean Markdown Response */}
                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}

                        <div className="mt-1.5 text-[10px] text-slate-400/80 flex items-center justify-end">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {isUser && (
                        <div className="h-7 w-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-300">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* Live Streaming Message */}
              {isStreaming && (
                <div className="flex items-start space-x-3 justify-start animate-in fade-in duration-200">
                  <div className="h-7 w-7 rounded-lg bg-blue-600/30 border border-blue-500/50 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-300">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="max-w-[85%] rounded-xl p-3.5 bg-[#161b22] border border-blue-500/40 text-slate-200 rounded-tl-none shadow-md">
                    {/* Live Thinking Block */}
                    {(currentThought || (!currentReply && isStreaming)) && (
                      <ThinkingBlock reasoning={currentThought} isStreaming={!currentReply} />
                    )}

                    {/* Live Output Stream */}
                    {currentReply ? (
                      <MarkdownRenderer content={currentReply} />
                    ) : (
                      <div className="flex items-center space-x-2 text-xs text-slate-400 py-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
                        <span>Jarvis is generating response...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-[#30363d] bg-[#161b22]">
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
                        : 'Ask Jarvis or enter a goal to plan and execute...'
                  }
                  disabled={isStreaming}
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isStreaming}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center space-x-1.5 transition shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>

          {/* Optional Right Column: Audit Timeline & Plan */}
          {timelineOpen && (
            <div className="w-80 border-l border-[#30363d] bg-[#161b22] flex flex-col min-h-0">
              <div className="p-3 border-b border-[#30363d] flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Audit Timeline
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {timelineEvents.length} events
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-sans">
                    No timeline logs recorded yet.
                  </div>
                ) : (
                  timelineEvents.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded bg-[#0d1117] border border-[#21262d]">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-300 truncate">{ev.title}</span>
                        <span className="text-slate-500">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      {ev.details && (
                        <p className="text-slate-400 text-[11px] leading-relaxed break-words font-sans">
                          {ev.details}
                        </p>
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
          <div className="bg-[#161b22] border border-amber-500/60 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-white">
                    {taskState.currentApproval.title || 'Action Requires Approval'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/80 border border-amber-700 text-amber-300">
                    {taskState.currentApproval.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ADR-004 Policy Engine: Assistive Autonomy requires explicit approval.
                </p>
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-3.5 border border-[#30363d] space-y-3 text-xs">
              {/* Command Box */}
              {taskState.currentApproval.command && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                    Exact Command to Execute:
                  </span>
                  <div className="bg-[#05080f] p-2.5 rounded border border-[#1e293b] font-mono text-emerald-400 text-xs flex items-center justify-between">
                    <code>{taskState.currentApproval.command}</code>
                    <span className="text-[10px] text-slate-500 font-sans">powershell -NoProfile</span>
                  </div>
                </div>
              )}

              {/* Target Directory */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">
                  Target Directory:
                </span>
                <code className="text-slate-300 font-mono text-[11px] break-all">
                  {taskState.currentApproval.workingDirectory || taskState.currentApproval.workspacePath}
                </code>
              </div>

              {/* Purpose */}
              {taskState.currentApproval.explanation && (
                <div className="p-2.5 rounded bg-blue-950/30 border border-blue-900/50 text-blue-200 text-xs">
                  <strong className="block text-blue-300 font-semibold mb-0.5">Purpose:</strong>
                  {taskState.currentApproval.explanation}
                </div>
              )}

              {/* Safety Impact */}
              {taskState.currentApproval.safetyImpact && (
                <div className="p-2.5 rounded bg-slate-900/50 border border-slate-800 text-slate-300 text-[11px]">
                  <strong className="block text-slate-200 font-semibold mb-0.5">Safety & Process Impact:</strong>
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/50 transition"
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
          // Refresh model catalog with updated settings
          const catalog = await window.jarvisAPI.getAvailableModels()
          setModelCatalog(catalog)
        }}
      />
    </div>
  )
}
