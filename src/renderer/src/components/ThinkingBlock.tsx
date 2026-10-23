import React, { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react'

interface ThinkingBlockProps {
  reasoning: string
  isStreaming?: boolean
}

export function ThinkingBlock({ reasoning, isStreaming = false }: ThinkingBlockProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  if (!reasoning && !isStreaming) {
    return null
  }

  const charCount = reasoning.length
  const approxTokens = Math.round(charCount / 4)

  return (
    <div className="w-full mb-3 rounded-xl border border-[#1f3832] bg-[#070d0f] shadow-lg overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-[#111f1e] to-[#0c1616] hover:from-[#172c29] hover:to-[#101f1e] transition text-left cursor-pointer select-none border-b border-[#1f3832]/80"
      >
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-[#172c29] border border-[#2b5049]">
            <Brain className={`w-3.5 h-3.5 ${isStreaming ? 'text-[#3ba172] animate-pulse' : 'text-[#3ba172]'}`} />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#52c48e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3ba172]"></span>
              </span>
            )}
          </div>

          <div>
            <span className="font-semibold text-xs text-[#f5f1ee] tracking-wide flex items-center space-x-2">
              <span>{isStreaming ? 'Inner Reasoning & Planning...' : 'Reasoning Trace'}</span>
              {!isStreaming && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3ba172]" />
              )}
            </span>
          </div>

          {charCount > 0 && (
            <span className="text-[10px] text-[#8a9992] font-mono bg-[#111f1e] px-1.5 py-0.5 rounded border border-[#1f3832]">
              ~{approxTokens} tokens
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[#8a9992] text-[11px]">
          {isStreaming ? (
            <span className="flex items-center space-x-1 text-[#52c48e] animate-pulse font-medium">
              <Sparkles className="w-3 h-3 text-[#3ba172]" />
              <span>Thinking</span>
            </span>
          ) : (
            <span className="text-[11px] text-[#8a9992] hover:text-[#d1d7d0]">{isExpanded ? 'Collapse' : 'Expand'}</span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#3ba172]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#3ba172]" />
          )}
        </div>
      </button>

      {/* Expanded Deliberation View */}
      {isExpanded && (
        <div className="p-3.5 bg-[#05090a] text-[11px] font-mono text-[#d1d7d0] leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto selection:bg-[#1f3832] border-t border-[#132220]">
          {reasoning || (
            <div className="flex items-center space-x-2 text-[#8a9992] italic py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3ba172] animate-ping"></span>
              <span>Deliberating and structuring execution plan...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
