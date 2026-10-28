import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Copy,
  CornerDownLeft,
  Maximize2,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap
} from 'lucide-react'
import type {
  ApprovalRequest,
  ChatMessage,
  Conversation,
  JarvisSettings,
  TalkingStyle,
  TaskMode,
  TaskState,
  ThinkingDepth
} from '../../../shared/types'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { ThinkingBlock } from '../components/ThinkingBlock'
import { RateLimitCard } from '../components/RateLimitCard'
import { PromptControlsBar } from '../components/PromptControlsBar'
import { JarvisMark } from '../components/brand/JarvisMark'
import { Badge, Button, IconButton, Spinner } from '../components/ui'
import { applyTheme, readCachedTheme } from '../lib/theme'
import { cn } from '../lib/cn'

interface QuickChatComposerProps {
  onSubmit: (prompt: string) => void
  isStreaming: boolean
}

const QuickChatComposer = React.memo(function QuickChatComposer({
  onSubmit,
  isStreaming
}: QuickChatComposerProps): React.JSX.Element {
  const [inputPrompt, setInputPrompt] = useState('')
  const canSend = Boolean(inputPrompt.trim()) && !isStreaming

  const handleSubmit = (event?: React.FormEvent): void => {
    event?.preventDefault()
    const trimmed = inputPrompt.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
    setInputPrompt('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (canSend) handleSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1.5">
      <div className="rounded-lg border border-jarvis-border bg-jarvis-base p-1.5 transition focus-within:border-jarvis-accent/55 focus-within:ring-1 focus-within:ring-jarvis-accent/15">
        <textarea
          value={inputPrompt}
          onChange={(event) => setInputPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Thinking…' : 'Instruct Jarvis…'}
          aria-label="Message Jarvis"
          className="max-h-24 min-h-[40px] w-full resize-none bg-transparent px-1.5 py-1 text-[11.5px] leading-relaxed text-jarvis-ivory placeholder:text-jarvis-muted/75 focus:outline-none disabled:opacity-60"
          autoFocus
        />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 pl-1 text-[8.5px] text-jarvis-muted/75">
            <CornerDownLeft className="h-2.5 w-2.5" />
            send · shift+enter for a new line
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSend}
            className="h-7 gap-1 px-2.5 text-[10px]"
          >
            <Send className="h-3 w-3" />
            Send
          </Button>
        </div>
      </div>
    </form>
  )
})

export function QuickChatApp(): React.JSX.Element {
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentThought, setCurrentThought] = useState('')
  const [currentReply, setCurrentReply] = useState('')
  const [talkingStyle, setTalkingStyle] = useState<TalkingStyle>('direct')
  const [taskMode, setTaskMode] = useState<TaskMode>('chat')
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('quick')
  const [settings, setSettings] = useState<JarvisSettings>({
    gatewayUrl: 'http://127.0.0.1:31415/v1',
    defaultModel: 'gemini-3.6-flash',
    lightMode: false,
    workspacePaths: ['C:\\work\\softwares\\jarvis'],
    theme: readCachedTheme(),
    outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
  })
  const [taskState, setTaskState] = useState<TaskState | null>(null)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyTheme(settings.theme || 'system')
  }, [settings.theme])

  const scrollToBottom = (): void => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentThought, currentReply])

  useEffect(() => {
    if (!window.jarvisAPI) return

    window.jarvisAPI.getSettings().then((loaded) => {
      setSettings(loaded)
      if (loaded.talkingStyle) setTalkingStyle(loaded.talkingStyle)
      if (loaded.taskMode) setTaskMode(loaded.taskMode)
      if (loaded.thinkingDepth) setThinkingDepth(loaded.thinkingDepth)
    })

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

  const handleSendMessage = async (promptToSend?: string): Promise<void> => {
    const prompt = (promptToSend || '').trim()
    if (!prompt || isStreaming) return

    if (!window.jarvisAPI || !activeConv) return

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
        activeConv.id,
        prompt,
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
    await window.jarvisAPI?.openMainWindow()
  }

  const handleClose = async (): Promise<void> => {
    await window.jarvisAPI?.closeQuickChat()
  }

  const handleToggleLightMode = async (): Promise<void> => {
    if (!window.jarvisAPI) return
    const updated = await window.jarvisAPI.updateSettings({ lightMode: !settings.lightMode })
    setSettings(updated)
  }

  const handleCopyCommand = async (): Promise<void> => {
    const command = taskState?.currentApproval?.command
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(true)
      window.setTimeout(() => setCopiedCommand(false), 1600)
    } catch {
      // Clipboard access is best-effort.
    }
  }



  const approval = taskState?.currentApproval

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-xl border border-jarvis-border bg-jarvis-base font-sans text-jarvis-sage shadow-floating">
      <header className="drag-region flex h-12 shrink-0 items-center gap-2.5 border-b border-jarvis-border bg-jarvis-surface px-3">
        <JarvisMark className="h-5 w-5 shrink-0 text-jarvis-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-[15px] font-semibold leading-none tracking-[-0.02em] text-jarvis-ivory">
              Quick chat
            </h2>
            <Badge variant="accent" dot className="px-1.5 py-0.5 text-[8.5px]">
              local
            </Badge>
            {settings.lightMode && (
              <Badge variant="signal" className="px-1.5 py-0.5 text-[8.5px]">
                fast
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[9.5px] text-jarvis-muted">
            {activeConv?.title || 'Jarvis General Chat'}
          </p>
        </div>

        <div className="no-drag flex items-center gap-0.5">
          <IconButton
            label={settings.lightMode ? 'Disable fast mode' : 'Enable fast mode'}
            size="sm"
            onClick={() => void handleToggleLightMode()}
            active={settings.lightMode}
          >
            <Zap className={cn('h-3.5 w-3.5', settings.lightMode && 'fill-current')} />
          </IconButton>
          <IconButton label="Open full Jarvis" size="sm" onClick={() => void handleOpenMain()}>
            <Maximize2 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Close quick chat" size="sm" onClick={() => void handleClose()}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </header>

      <div className="flex-1 select-text overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col justify-center py-4">
            <div className="mb-3">
              <p className="text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-muted">
                A quiet line to Jarvis
              </p>
              <h3 className="mt-1.5 font-display text-[23px] font-semibold leading-[1.08] tracking-[-0.025em] text-jarvis-ivory">
                What do you need, quickly?
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-jarvis-muted">
                Ask a question or issue an instruction. Gated actions still ask first.
              </p>
            </div>

            <div className="space-y-1.5">
              {[
                ['Status & active model', 'What is your current status and model?'],
                ['Open Gmail in Chrome', 'open my gmail from chrome'],
                ['Inspect git status', 'Inspect project git status']
              ].map(([label, prompt]) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSendMessage(prompt)}
                  className="group flex w-full items-center justify-between rounded-md border border-jarvis-border bg-jarvis-surface px-2.5 py-2 text-left transition hover:border-jarvis-accent/40 hover:bg-jarvis-elevated"
                >
                  <span className="text-[11px] font-medium text-jarvis-sage group-hover:text-jarvis-ivory">
                    {label}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-jarvis-muted/60 group-hover:text-jarvis-accent" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isUser = message.role === 'user'
              let isRateLimit = false
              let rateLimitInfo: { retrySeconds?: number; model?: string } = {}
              try {
                const parsed = JSON.parse(message.content)
                if (parsed.__rateLimit__) {
                  isRateLimit = true
                  rateLimitInfo = parsed
                }
              } catch {
                if (message.content.includes('429') && message.content.includes('rate_limit_exceeded')) {
                  isRateLimit = true
                }
              }

              if (isUser) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[88%] rounded-xl rounded-br-sm bg-jarvis-accent px-3 py-2 text-jarvis-accentContrast">
                      <p className="whitespace-pre-wrap text-[11.5px] font-medium leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <article key={message.id}>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <JarvisMark className="h-4 w-4 text-jarvis-accent" />
                    <span className="text-[10px] font-semibold text-jarvis-ivory">Jarvis</span>
                    <span className="font-mono text-[8.5px] text-jarvis-muted">
                      {settings.lightMode ? 'gemini-flash-lite' : settings.defaultModel}
                    </span>
                  </div>
                  {message.reasoning && (
                    <ThinkingBlock reasoning={message.reasoning} isStreaming={false} />
                  )}
                  {isRateLimit ? (
                    <RateLimitCard
                      initialSeconds={rateLimitInfo.retrySeconds || 75}
                      model={rateLimitInfo.model || settings.defaultModel}
                      onSwitchLightMode={() => void handleToggleLightMode()}
                      onOpenHub={() => void handleOpenMain()}
                      onRetry={() => {
                        const lastUser = [...messages].reverse().find((item) => item.role === 'user')
                        if (lastUser) void handleSendMessage(lastUser.content)
                      }}
                    />
                  ) : (
                    <div className="rounded-lg border border-jarvis-border bg-jarvis-elevated/60 p-3">
                      <div className="prose-jarvis text-[12px]">
                        <MarkdownRenderer content={message.content} />
                      </div>
                    </div>
                  )}
                </article>
              )
            })}

            {isStreaming && (
              <article>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <JarvisMark className="h-4 w-4 text-jarvis-accent" />
                  <span className="text-[10px] font-semibold text-jarvis-ivory">Jarvis</span>
                  <span className="flex items-center gap-1 font-mono text-[8.5px] text-jarvis-accent">
                    <span className="h-1 w-1 animate-pulse-dot rounded-full bg-jarvis-accent" />
                    working
                  </span>
                </div>
                {(currentThought || (!currentReply && isStreaming)) && (
                  <ThinkingBlock reasoning={currentThought} isStreaming={!currentReply} />
                )}
                {currentReply ? (
                  <div className="prose-jarvis streaming-caret rounded-lg border border-jarvis-accent/35 bg-jarvis-elevated/60 p-3 text-[12px]">
                    <MarkdownRenderer content={currentReply} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-jarvis-border bg-jarvis-elevated/60 px-3 py-2 text-[10.5px] text-jarvis-muted">
                    <Spinner className="text-jarvis-accent" />
                    Jarvis is thinking…
                  </div>
                )}
              </article>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Floating Permission Modal / Card in Quick Chat (Pinned and Unclipped) */}
      {approval && (
        <>
          <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[1.5px] animate-fade-in" />
          <div className="absolute inset-x-2.5 bottom-2.5 z-50 flex max-h-[82%] flex-col animate-slide-up rounded-xl border border-jarvis-signal/45 bg-jarvis-surface p-3 shadow-floating">
            <div className="flex items-start gap-2.5 shrink-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-jarvis-signal/30 bg-jarvis-signalSoft/60 text-jarvis-signal shadow-sm">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-jarvis-signal">
                    Approval required
                  </p>
                  <span className="rounded-full border border-jarvis-signal/30 bg-jarvis-signalSoft/80 px-1.5 py-0.2 font-mono text-[8px] uppercase tracking-wider text-jarvis-signal">
                    {approval.category.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-jarvis-ivory truncate">
                  {approval.title || 'Review this exact action.'}
                </p>
              </div>
              {approval.command && (
                <button
                  type="button"
                  onClick={() => void handleCopyCommand()}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-jarvis-border bg-jarvis-elevated px-1.5 py-0.5 text-[9px] text-jarvis-muted transition hover:bg-jarvis-hover hover:text-jarvis-ivory"
                  title="Copy command"
                >
                  {copiedCommand ? (
                    <>
                      <Check className="h-2.5 w-2.5 text-jarvis-accent" />
                      copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-2.5 w-2.5" />
                      copy
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              <div className="code-well select-text rounded-md border border-jarvis-border bg-jarvis-code p-2">
                <code className="block max-h-24 overflow-y-auto break-all font-mono text-[10px] leading-relaxed text-jarvis-codeInk">
                  {approval.command || approval.actionType}
                </code>
              </div>

              <p className="break-all font-mono text-[8.5px] leading-snug text-jarvis-muted" title={approval.workingDirectory || approval.workspacePath}>
                📁 {approval.workingDirectory || approval.workspacePath}
              </p>

              {approval.explanation && (
                <p className="rounded border border-jarvis-border/60 bg-jarvis-elevated/40 p-1.5 text-[9.5px] leading-relaxed text-jarvis-sage">
                  {approval.explanation}
                </p>
              )}
            </div>

            <div className="mt-2.5 shrink-0 flex items-center justify-between gap-2 border-t border-jarvis-border pt-2">
              <span className="flex items-center gap-1 text-[8.5px] text-jarvis-muted">
                <ShieldCheck className="h-2.5 w-2.5 text-jarvis-accent" />
                one-time execution
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="dangerGhost"
                  size="sm"
                  onClick={() => void handleResolveApproval(approval, 'denied')}
                  className="h-7 px-2.5 text-[10.5px]"
                >
                  Deny
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleResolveApproval(approval, 'granted')}
                  className="h-7 px-3 text-[10.5px]"
                >
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="shrink-0 border-t border-jarvis-border bg-jarvis-surface px-2.5 pb-2.5 pt-2">
        <PromptControlsBar
          talkingStyle={talkingStyle}
          taskMode={taskMode}
          thinkingDepth={thinkingDepth}
          onStyleChange={(style) => {
            setTalkingStyle(style)
            if (window.jarvisAPI) window.jarvisAPI.updateSettings({ talkingStyle: style })
          }}
          onModeChange={(mode) => {
            setTaskMode(mode)
            if (window.jarvisAPI) window.jarvisAPI.updateSettings({ taskMode: mode })
          }}
          onDepthChange={(depth) => {
            setThinkingDepth(depth)
            if (window.jarvisAPI) window.jarvisAPI.updateSettings({ thinkingDepth: depth })
          }}
          compact
        />

        <QuickChatComposer onSubmit={handleSendMessage} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
