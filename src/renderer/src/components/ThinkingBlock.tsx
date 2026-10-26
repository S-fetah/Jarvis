import React, { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, Sparkles, CheckCircle2, Copy, Check } from 'lucide-react'

interface ThinkingBlockProps {
  reasoning: string
  isStreaming?: boolean
}

export function ThinkingBlock({ reasoning, isStreaming = false }: ThinkingBlockProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const [copied, setCopied] = useState<boolean>(false)

  if (!reasoning && !isStreaming) {
    return null
  }

  const charCount = reasoning.length
  const approxTokens = Math.round(charCount / 4)

  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!reasoning) return
    navigator.clipboard.writeText(reasoning)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full mb-3 rounded-xl border border-jarvis-border bg-jarvis-surface shadow-sm overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-jarvis-elevated hover:bg-jarvis-hover transition text-left cursor-pointer select-none border-b border-jarvis-border"
      >
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-jarvis-surface border border-jarvis-borderStrong">
            <Brain className={`w-3.5 h-3.5 ${isStreaming ? 'text-jarvis-accent animate-pulse' : 'text-jarvis-accent'}`} />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jarvis-accentGlow opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-jarvis-accent"></span>
              </span>
            )}
          </div>

          <div>
            <span className="font-semibold text-xs text-jarvis-ivory tracking-wide flex items-center space-x-2">
              <span>{isStreaming ? 'Inner Reasoning & Planning...' : 'Reasoning Trace'}</span>
              {!isStreaming && (
                <CheckCircle2 className="w-3.5 h-3.5 text-jarvis-accent" />
              )}
            </span>
          </div>

          {charCount > 0 && (
            <span className="text-[10px] text-jarvis-muted font-mono bg-jarvis-surface px-1.5 py-0.5 rounded border border-jarvis-border">
              ~{approxTokens} tokens
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-jarvis-muted text-[11px]">
          {/* Copy Reasoning Button */}
          {reasoning && (
            <span
              onClick={handleCopy}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-jarvis-surface border border-jarvis-border text-jarvis-muted hover:text-jarvis-ivory transition cursor-pointer"
              title="Copy Reasoning"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-jarvis-accent" />
                  <span className="text-[10px] text-jarvis-accent">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </span>
          )}

          {isStreaming ? (
            <span className="flex items-center space-x-1 text-jarvis-accentGlow animate-pulse font-medium">
              <Sparkles className="w-3 h-3 text-jarvis-accent" />
              <span>Thinking</span>
            </span>
          ) : (
            <span className="text-[11px] text-jarvis-muted hover:text-jarvis-ivory">{isExpanded ? 'Collapse' : 'Expand'}</span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-jarvis-accent" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-jarvis-accent" />
          )}
        </div>
      </button>

      {/* Expanded Deliberation View */}
      {isExpanded && (
        <div className="p-3.5 bg-jarvis-elevated/30 text-[11px] font-mono text-jarvis-sage leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto selection:bg-jarvis-hover border-t border-jarvis-border select-text">
          {reasoning || (
            <div className="flex items-center space-x-2 text-jarvis-muted italic py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-jarvis-accent animate-ping"></span>
              <span>Deliberating and structuring execution plan...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
