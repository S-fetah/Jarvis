import React from 'react'
import { Check, Copy, Cpu } from 'lucide-react'
import type { ChatMessage } from '../../../../shared/types'
import { formatTime } from '../../lib/format'
import { JarvisMark } from '../brand/JarvisMark'
import { IconButton, Spinner } from '../ui'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ThinkingBlock } from '../ThinkingBlock'
import { RateLimitCard } from '../RateLimitCard'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  currentThought: string
  currentReply: string
  model: string
  lightMode: boolean
  copiedMessageId: string | null
  onCopyMessage: (id: string, text: string) => void
  onSwitchLightMode: () => void
  onOpenHub: () => void
  onRetry: () => void
}

function parseRateLimit(content: string): { isRateLimit: boolean; info: { retrySeconds?: number; model?: string } } {
  try {
    const parsed = JSON.parse(content)
    if (parsed.__rateLimit__) return { isRateLimit: true, info: parsed }
  } catch {
    if (content.includes('429') && content.includes('rate_limit_exceeded')) {
      return { isRateLimit: true, info: {} }
    }
  }
  return { isRateLimit: false, info: {} }
}

interface MessageItemProps {
  message: ChatMessage
  model: string
  lightMode: boolean
  isCopied: boolean
  onCopyMessage: (id: string, text: string) => void
  onSwitchLightMode: () => void
  onOpenHub: () => void
  onRetry: () => void
}

const MessageItem = React.memo(function MessageItem({
  message,
  model,
  lightMode,
  isCopied,
  onCopyMessage,
  onSwitchLightMode,
  onOpenHub,
  onRetry
}: MessageItemProps): React.JSX.Element {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex animate-slide-up justify-end">
        <div className="max-w-[78%]">
          <div className="rounded-2xl rounded-br-sm bg-jarvis-accent px-4 py-3 text-jarvis-accentContrast shadow-hairline">
            <p className="select-text whitespace-pre-wrap text-[13.5px] font-medium leading-relaxed">
              {message.content}
            </p>
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2 text-3xs font-semibold uppercase tracking-[0.13em] text-jarvis-muted">
            <span>You</span>
            <span className="h-1 w-1 rounded-full bg-jarvis-borderStrong" />
            <span className="font-mono font-normal tracking-normal">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  const { isRateLimit, info } = parseRateLimit(message.content)

  return (
    <article className="group animate-slide-up">
      <div className="mb-2.5 flex items-center gap-2.5">
        <JarvisMark className="h-[22px] w-[22px] text-jarvis-accent" />
        <span className="text-[11.5px] font-semibold text-jarvis-ivory">Jarvis</span>
        <span className="h-1 w-1 rounded-full bg-jarvis-borderStrong" />
        <span className="flex items-center gap-1 font-mono text-[10px] text-jarvis-muted">
          <Cpu className="h-3 w-3" />
          {lightMode ? 'gemini-flash-lite' : model}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-jarvis-muted/80">
            {formatTime(message.timestamp)}
          </span>
          <IconButton
            label={isCopied ? 'Copied response' : 'Copy response'}
            size="sm"
            onClick={() => onCopyMessage(message.id, message.content)}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-jarvis-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </IconButton>
        </span>
      </div>

      {message.reasoning && <ThinkingBlock reasoning={message.reasoning} isStreaming={false} />}

      {isRateLimit ? (
        <RateLimitCard
          initialSeconds={info.retrySeconds || 75}
          model={info.model || model}
          onSwitchLightMode={onSwitchLightMode}
          onOpenHub={onOpenHub}
          onRetry={onRetry}
        />
      ) : (
        <div className="prose-jarvis select-text">
          <MarkdownRenderer content={message.content} />
        </div>
      )}
    </article>
  )
})

export const MessageList = React.memo(function MessageList({
  messages,
  isStreaming,
  currentThought,
  currentReply,
  model,
  lightMode,
  copiedMessageId,
  onCopyMessage,
  onSwitchLightMode,
  onOpenHub,
  onRetry
}: MessageListProps): React.JSX.Element {
  return (
    <div className="space-y-8">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          model={model}
          lightMode={lightMode}
          isCopied={copiedMessageId === message.id}
          onCopyMessage={onCopyMessage}
          onSwitchLightMode={onSwitchLightMode}
          onOpenHub={onOpenHub}
          onRetry={onRetry}
        />
      ))}

      {isStreaming && (
        <article className="animate-fade-in">
          <div className="mb-2.5 flex items-center gap-2.5">
            <JarvisMark className="h-[22px] w-[22px] text-jarvis-accent" />
            <span className="text-[11.5px] font-semibold text-jarvis-ivory">Jarvis</span>
            <span className="h-1 w-1 rounded-full bg-jarvis-borderStrong" />
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-jarvis-accent">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-jarvis-accent" />
              working
            </span>
          </div>

          {(currentThought || (!currentReply && isStreaming)) && (
            <ThinkingBlock reasoning={currentThought} isStreaming={!currentReply} />
          )}

          {currentReply ? (
            <div className="prose-jarvis streaming-caret select-text">
              <MarkdownRenderer content={currentReply} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-md border border-jarvis-border bg-jarvis-elevated/60 px-3 py-2.5 text-[11.5px] text-jarvis-muted">
              <Spinner className="text-jarvis-accent" />
              <span>Deliberating and preparing a response…</span>
            </div>
          )}
        </article>
      )}
    </div>
  )
})
