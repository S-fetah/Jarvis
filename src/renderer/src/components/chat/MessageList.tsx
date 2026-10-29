import React, { useState } from 'react'
import {
  Check,
  Clock,
  Copy,
  Cpu,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  RotateCw
} from 'lucide-react'
import type { ChatMessage } from '../../../../shared/types'
import { formatTime } from '../../lib/format'
import { JarvisMark } from '../brand/JarvisMark'
import { Button, IconButton, Spinner } from '../ui'
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
  onResubmitPrompt?: (newPrompt: string) => void
  onOpenCanvas?: (params: { url: string; type: 'browser' | 'pdf' | 'preview'; title: string; filePath?: string }) => void
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
  onResubmitPrompt?: (newPrompt: string) => void
  onOpenCanvas?: (params: { url: string; type: 'browser' | 'pdf' | 'preview'; title: string; filePath?: string }) => void
}

export function detectAssetInMessage(content: string): {
  url: string
  type: 'browser' | 'pdf'
  label: string
  isPdf: boolean
} | null {
  // 1. Detect live web / dev URLs
  const urlMatch = content.match(/(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s)]*)?)/i)
  if (urlMatch) {
    return { url: urlMatch[1], type: 'browser', label: urlMatch[1], isPdf: false }
  }

  // 2. Detect absolute Windows path to PDF (e.g. C:\work\softwares\jarvis\output\chat_summary.pdf)
  const absWinMatch = content.match(/([a-zA-Z]:[\\/][^\s\n"'`)]+?\.pdf)/i)
  if (absWinMatch) {
    const fullPath = absWinMatch[1].replace(/[.,;:!?]+$/, '')
    const parts = fullPath.split(/[\\/]/)
    const label = parts[parts.length - 1] || fullPath
    return { url: fullPath, type: 'pdf', label, isPdf: true }
  }

  // 3. Detect output-relative path (e.g. output/chat_summary.pdf or output\chat_summary.pdf)
  const relMatch = content.match(/((?:output[\\/])[\w.-]+\.pdf)/i)
  if (relMatch) {
    const fullPath = relMatch[1]
    const label = fullPath.split(/[\\/]/).pop() || fullPath
    return { url: fullPath, type: 'pdf', label, isPdf: true }
  }

  // 4. Detect absolute Unix path to PDF
  const absUnixMatch = content.match(/(?:^|[\s"'`])(\/(?:[^\s\n"'`)]+?\/)*?[^\s\n"'`)]+?\.pdf)/i)
  if (absUnixMatch) {
    const fullPath = absUnixMatch[1].replace(/[.,;:!?]+$/, '')
    const parts = fullPath.split('/')
    const label = parts[parts.length - 1] || fullPath
    return { url: fullPath, type: 'pdf', label, isPdf: true }
  }

  // 5. Detect bare filename with .pdf extension
  const bareMatch = content.match(/([\w.-]+\.pdf)/i)
  if (bareMatch) {
    return { url: bareMatch[0], type: 'pdf', label: bareMatch[0], isPdf: true }
  }

  return null
}

const MessageItem = React.memo(function MessageItem({
  message,
  model,
  lightMode,
  isCopied,
  onCopyMessage,
  onSwitchLightMode,
  onOpenHub,
  onRetry,
  onResubmitPrompt,
  onOpenCanvas
}: MessageItemProps): React.JSX.Element {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  if (isUser) {
    if (isEditing) {
      return (
        <div className="flex animate-slide-up justify-end">
          <div className="w-full max-w-[85%] rounded-2xl border border-jarvis-borderStrong bg-jarvis-surface p-3 shadow-raised">
            <span className="text-3xs font-semibold uppercase tracking-wider text-jarvis-accent">
              Edit Prompt
            </span>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-jarvis-border bg-jarvis-base p-2 text-xs text-jarvis-ivory focus:border-jarvis-accent/60 focus:outline-none"
              autoFocus
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditContent(message.content)
                  setIsEditing(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!editContent.trim()}
                onClick={() => {
                  setIsEditing(false)
                  if (editContent.trim() && onResubmitPrompt) {
                    onResubmitPrompt(editContent.trim())
                  }
                }}
              >
                Save & Resubmit
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="group relative flex animate-slide-up justify-end">
        <div className="relative max-w-[80%]">
          {/* User Prompt Hover Toolbar */}
          <div className="absolute -top-3.5 right-2 z-10 flex items-center gap-0.5 rounded-full border border-jarvis-border bg-jarvis-elevated px-1.5 py-0.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <IconButton
              label={isCopied ? 'Copied prompt' : 'Copy prompt'}
              size="sm"
              onClick={() => onCopyMessage(message.id, message.content)}
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-jarvis-accent" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </IconButton>
            <IconButton
              label="Edit prompt"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="h-3 w-3" />
            </IconButton>
            <IconButton
              label="Retry prompt"
              size="sm"
              onClick={() => onResubmitPrompt?.(message.content)}
            >
              <RotateCw className="h-3 w-3" />
            </IconButton>
          </div>

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

  // Detect live links or PDFs in assistant message
  const detectedAsset = React.useMemo(() => detectAssetInMessage(message.content), [message.content])

  return (
    <article className="group animate-slide-up">
      <div className="mb-2.5 flex items-center gap-2.5">
        <JarvisMark className="h-[22px] w-[22px] text-jarvis-accent" />
        <span className="text-[11.5px] font-semibold text-jarvis-ivory">Jarvis</span>
        <span className="h-1 w-1 rounded-full bg-jarvis-borderStrong" />
        <span className="flex items-center gap-1 font-mono text-[10px] text-jarvis-muted">
          <Cpu className="h-3 w-3" />
          {message.model || (lightMode ? 'gemini-flash-lite' : model)}
        </span>
        {message.latencyMs && (
          <>
            <span className="h-1 w-1 rounded-full bg-jarvis-borderStrong" />
            <span className="flex items-center gap-1 font-mono text-[10px] text-jarvis-accent">
              <Clock className="h-2.5 w-2.5" />
              {(message.latencyMs / 1000).toFixed(1)}s
            </span>
          </>
        )}
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

      {/* Interactive Canvas Quick-Action Card */}
      {detectedAsset && onOpenCanvas && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-jarvis-accent/30 bg-jarvis-accentSoft/20 p-2.5 transition hover:border-jarvis-accent/50">
          <div className="flex min-w-0 items-center gap-2">
            {detectedAsset.isPdf ? (
              <FileText className="h-4 w-4 shrink-0 text-jarvis-accent" />
            ) : (
              <Globe className="h-4 w-4 shrink-0 text-jarvis-accent" />
            )}
            <span className="truncate font-mono text-[11px] text-jarvis-ivory">
              {detectedAsset.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenCanvas({
                url: detectedAsset.url,
                type: detectedAsset.type,
                title: detectedAsset.label,
                filePath: detectedAsset.isPdf ? detectedAsset.url : undefined
              })
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-jarvis-accent px-2.5 py-1 text-[11px] font-semibold text-jarvis-accentContrast shadow transition hover:opacity-90"
          >
            <span>Preview in Canvas</span>
            <ExternalLink className="h-3 w-3" />
          </button>
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
  onRetry,
  onResubmitPrompt,
  onOpenCanvas
}: MessageListProps): React.JSX.Element {
  return (
    <div className="space-y-6">
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
          onResubmitPrompt={onResubmitPrompt}
          onOpenCanvas={onOpenCanvas}
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
