import React, { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'

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
    <div className="mb-3 rounded-lg border border-purple-800/40 bg-[#0f121d] shadow-sm overflow-hidden transition-all">
      {/* Header bar */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2 bg-[#171b2b] hover:bg-[#1e2338] text-xs transition cursor-pointer select-none text-left"
      >
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center">
            <Brain className={`w-4 h-4 ${isStreaming ? 'text-purple-400 animate-pulse' : 'text-purple-400'}`} />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
          </div>
          <span className="font-semibold text-purple-200">
            {isStreaming ? 'Thinking & Planning Process...' : 'Thinking Process'}
          </span>
          {charCount > 0 && (
            <span className="text-[10px] text-purple-300/70 font-mono">
              (~{approxTokens} tokens)
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-purple-300/80 text-[11px]">
          {isStreaming ? (
            <span className="flex items-center space-x-1 text-purple-300 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Reasoning</span>
            </span>
          ) : (
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          )}
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded Reasoning Content */}
      {isExpanded && (
        <div className="p-3.5 border-t border-purple-900/30 bg-[#0b0e17] text-xs font-mono text-purple-200/90 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
          {reasoning || (
            <span className="italic text-slate-500 animate-pulse">Generating chain-of-thought...</span>
          )}
        </div>
      )}
    </div>
  )
}
