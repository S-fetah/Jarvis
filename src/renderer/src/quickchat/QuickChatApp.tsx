import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  X,
  Maximize2,
  Bot,
  User,
  Sparkles,
  Zap,
  ShieldAlert
} from 'lucide-react'
import {
  ChatMessage,
  TaskState,
  ApprovalRequest,
  JarvisSettings,
  Conversation
} from '../../../shared/types'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { ThinkingBlock } from '../components/ThinkingBlock'
import { RateLimitCard } from '../components/RateLimitCard'

export function QuickChatApp(): React.JSX.Element {
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputPrompt, setInputPrompt] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentThought, setCurrentThought] = useState('')
  const [currentReply, setCurrentReply] = useState('')
  const [settings, setSettings] = useState<JarvisSettings>({
    gatewayUrl: 'http://127.0.0.1:31415/v1',
    defaultModel: 'gemini-3.6-flash',
    lightMode: false,
    workspacePaths: ['C:\\work\\softwares\\jarvis'],
    theme: 'dark',
    outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
  })
  const [taskState, setTaskState] = useState<TaskState | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (): void => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentThought, currentReply])

  useEffect(() => {
    if (!window.jarvisAPI) return

    window.jarvisAPI.getSettings().then((s) => setSettings(s))

    window.jarvisAPI.getActiveConversation().then((conv) => {
      setActiveConv(conv)
      setMessages(conv.messages || [])
    })

    const unsubTask = window.jarvisAPI.onTaskUpdated((state) => {
      setTaskState(state)
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
      unsubStream()
    }
  }, [])

  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string): Promise<void> => {
    if (e) e.preventDefault()
    const promptToSend = (customPrompt || inputPrompt).trim()
    if (!promptToSend || isStreaming) return

    if (!window.jarvisAPI || !activeConv) return

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
        activeConv.id,
        promptToSend,
        settings.workspacePaths[0]
      )

      const finalAssistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        reasoning: res.reasoning,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, finalAssistantMsg])
    } catch (err: any) {
      console.error('[QuickChat] Send error:', err)
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

  const handleResolveApproval = async (
    approval: ApprovalRequest,
    decision: 'granted' | 'denied'
  ): Promise<void> => {
    if (!window.jarvisAPI) return
    await window.jarvisAPI.resolveApproval(approval.id, decision)
  }

  const handleOpenMain = async (): Promise<void> => {
    if (window.jarvisAPI) {
      await window.jarvisAPI.openMainWindow()
    }
  }

  const handleClose = async (): Promise<void> => {
    if (window.jarvisAPI) {
      await window.jarvisAPI.closeQuickChat()
    }
  }

  const handleToggleLightMode = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const updated = await window.jarvisAPI.updateSettings({ lightMode: !settings.lightMode })
    setSettings(updated)
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-slate-200 border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden font-sans select-none">
      {/* Top Header */}
      <header className="h-11 px-3.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between flex-shrink-0 cursor-default">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
            J
          </div>
          <div>
            <h2 className="text-xs font-semibold text-white tracking-wide flex items-center space-x-1.5">
              <span>Jarvis Quick Chat</span>
              {settings.lightMode && (
                <span className="text-[9px] bg-amber-950/80 border border-amber-700 text-amber-300 px-1 rounded font-mono">
                  ⚡ Lite
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Light Mode quick toggle */}
          <button
            onClick={handleToggleLightMode}
            className={`p-1 rounded text-xs transition ${
              settings.lightMode
                ? 'text-amber-400 bg-amber-950/60 border border-amber-700'
                : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
            }`}
            title="Toggle fast Light Mode"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>

          {/* Expand to Main Application */}
          <button
            onClick={handleOpenMain}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition"
            title="Open Full Jarvis Application"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Quick Chat */}
          <button
            onClick={handleClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition"
            title="Close Quick Chat (Owl remains floating)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 min-h-0 select-text text-xs">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3 text-slate-400">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">What would you like Jarvis to do?</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Issue commands or ask questions quickly.</p>
            </div>
            <div className="flex flex-col space-y-1.5 w-full pt-1">
              <button
                onClick={() => handleSendMessage(undefined, 'What is your current status and model?')}
                className="w-full text-left p-2 rounded-lg bg-[#161b22] border border-[#21262d] hover:border-blue-500/50 text-[11px] text-slate-300 transition"
              >
                Status & Active Model
              </button>
              <button
                onClick={() => handleSendMessage(undefined, 'Inspect project git status')}
                className="w-full text-left p-2 rounded-lg bg-[#161b22] border border-[#21262d] hover:border-blue-500/50 text-[11px] text-slate-300 transition"
              >
                Inspect Git Status
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user'
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
                className={`flex items-start space-x-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="h-6 w-6 rounded-md bg-blue-600/30 border border-blue-500/50 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-300">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="max-w-[88%] flex flex-col space-y-1.5">
                  {!isUser && msg.reasoning && (
                    <ThinkingBlock reasoning={msg.reasoning} isStreaming={false} />
                  )}

                  {isUser ? (
                    <div className="bg-blue-600 text-white rounded-xl rounded-tr-none px-3 py-2 shadow-sm text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  ) : isRateLimit ? (
                    <RateLimitCard
                      initialSeconds={rateLimitInfo.retrySeconds || 75}
                      model={rateLimitInfo.model || settings.defaultModel}
                      onSwitchLightMode={handleToggleLightMode}
                      onOpenHub={handleOpenMain}
                      onRetry={() => {
                        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                        if (lastUser) handleSendMessage(undefined, lastUser.content)
                      }}
                    />
                  ) : (
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl rounded-tl-none p-3 shadow-sm text-slate-200">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="h-6 w-6 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-300">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Live Streaming Message */}
        {isStreaming && (
          <div className="flex items-start space-x-2 justify-start animate-in fade-in duration-150">
            <div className="h-6 w-6 rounded-md bg-blue-600/30 border border-blue-500/50 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-300">
              <Bot className="w-3.5 h-3.5" />
            </div>

            <div className="max-w-[88%] flex flex-col space-y-1.5 w-full">
              {(currentThought || (!currentReply && isStreaming)) && (
                <ThinkingBlock reasoning={currentThought} isStreaming={!currentReply} />
              )}
              {currentReply ? (
                <div className="bg-[#161b22] border border-blue-500/40 rounded-xl rounded-tl-none p-3 shadow-sm text-slate-200">
                  <MarkdownRenderer content={currentReply} />
                </div>
              ) : (
                <div className="bg-[#161b22]/70 border border-[#30363d] rounded-lg px-3 py-2 text-slate-400 text-[11px] flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping"></span>
                  <span>Jarvis is thinking...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ADR-004 Gated Action Card (If waiting for approval) */}
      {taskState?.currentApproval && (
        <div className="p-3 bg-amber-950/40 border-t border-amber-600/50 space-y-2 text-xs">
          <div className="flex items-center space-x-2 text-amber-300 font-semibold">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Action Requires Approval</span>
          </div>
          <div className="p-2 bg-black/60 rounded border border-[#30363d] font-mono text-[10px] text-emerald-400 truncate">
            {taskState.currentApproval.command || taskState.currentApproval.actionType}
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              onClick={() => handleResolveApproval(taskState.currentApproval!, 'denied')}
              className="px-2.5 py-1 rounded bg-red-950 text-red-300 border border-red-800 text-[11px]"
            >
              Deny
            </button>
            <button
              onClick={() => handleResolveApproval(taskState.currentApproval!, 'granted')}
              className="px-3 py-1 rounded bg-emerald-600 text-white font-medium text-[11px]"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Bottom Input Field */}
      <div className="p-2.5 bg-[#161b22] border-t border-[#30363d]">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={isStreaming ? 'Thinking...' : 'Instruct Jarvis...'}
            disabled={isStreaming}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
