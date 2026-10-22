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
    <div className="w-full mb-3 rounded-xl border border-indigo-900/50 bg-[#0a0d17] shadow-lg overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-[#121629] to-[#0d101d] hover:from-[#181d36] hover:to-[#111626] transition text-left cursor-pointer select-none border-b border-indigo-950/60"
      >
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center p-1 rounded-md bg-indigo-950/80 border border-indigo-800/60">
            <Brain className={`w-3.5 h-3.5 ${isStreaming ? 'text-indigo-400 animate-pulse' : 'text-indigo-400'}`} />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            )}
          </div>

          <div>
            <span className="font-semibold text-xs text-indigo-200 tracking-wide flex items-center space-x-2">
              <span>{isStreaming ? 'Inner Reasoning & Planning...' : 'Reasoning Trace'}</span>
              {!isStreaming && (
                <CheckCircle2 className="w-3 h-3 text-indigo-400" />
              )}
            </span>
          </div>

          {charCount > 0 && (
            <span className="text-[10px] text-indigo-300/60 font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900/50">
              ~{approxTokens} tokens
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-indigo-300/80 text-[11px]">
          {isStreaming ? (
            <span className="flex items-center space-x-1 text-indigo-300 animate-pulse">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Thinking</span>
            </span>
          ) : (
            <span className="text-[11px] text-indigo-400/80">{isExpanded ? 'Collapse' : 'Expand'}</span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
          )}
        </div>
      </button>

      {/* Expanded Deliberation View */}
      {isExpanded && (
        <div className="p-3.5 bg-[#06080f] text-[11px] font-mono text-indigo-200/90 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto selection:bg-indigo-900/50">
          {reasoning || (
            <div className="flex items-center space-x-2 text-indigo-400/70 italic py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
              <span>Deliberating and structuring execution plan...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
