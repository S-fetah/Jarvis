import React, { useState } from 'react'
import { Brain, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, Sparkles } from 'lucide-react'
import { IconButton } from './ui'

interface ThinkingBlockProps {
  reasoning: string
  isStreaming?: boolean
}

export function ThinkingBlock({ reasoning, isStreaming = false }: ThinkingBlockProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  if (!reasoning && !isStreaming) return null

  const approxTokens = Math.round(reasoning.length / 4)

  const handleCopy = async (event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    if (!reasoning) return
    try {
      await navigator.clipboard.writeText(reasoning)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access is best-effort.
    }
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-jarvis-border bg-jarvis-elevated/45">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent"
        >
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded border border-jarvis-border bg-jarvis-surface text-jarvis-accent">
            <Brain className="h-3 w-3" />
            {isStreaming && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-jarvis-accent" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold text-jarvis-ivory">
                {isStreaming ? 'Reasoning in progress' : 'Reasoning trace'}
              </span>
              {!isStreaming && <CheckCircle2 className="h-3 w-3 text-jarvis-accent" />}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-3xs text-jarvis-muted">
              {reasoning.length > 0 && <span className="font-mono">~{approxTokens} tokens</span>}
              {isStreaming && (
                <span className="flex items-center gap-1 text-jarvis-accent">
                  <Sparkles className="h-2.5 w-2.5" />
                  thinking
                </span>
              )}
            </span>
          </span>
          <span className="ml-auto text-jarvis-muted">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        </button>

        {reasoning && (
          <IconButton
            label={copied ? 'Reasoning copied' : 'Copy reasoning'}
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-jarvis-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </IconButton>
        )}
      </div>

      {expanded && (
        <div className="select-text border-t border-jarvis-border/70 px-3.5 py-3">
          <div className="max-h-72 overflow-y-auto border-l-2 border-jarvis-accent/25 pl-3 font-mono text-[10.5px] leading-relaxed text-jarvis-sage">
            {reasoning ? (
              <p className="whitespace-pre-wrap">{reasoning}</p>
            ) : (
              <p className="flex items-center gap-2 italic text-jarvis-muted">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-jarvis-accent" />
                Deliberating and structuring the execution plan…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
