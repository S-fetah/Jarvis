import React, { useState, useRef, useEffect } from 'react'
import { Cpu, Zap, ChevronDown, Search, Check, Sparkles } from 'lucide-react'
import { ModelCatalog } from '../../../shared/types'

interface ModelSelectorProps {
  currentModel: string
  isLightMode: boolean
  catalog: ModelCatalog
  onSelectModel: (model: string) => void
  onToggleLightMode: (enabled: boolean) => void
}

export function ModelSelector({
  currentModel,
  isLightMode,
  catalog,
  onSelectModel,
  onToggleLightMode
}: ModelSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredAll = catalog.all.filter((m) =>
    m.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isLight = (m: string): boolean => {
    return catalog.light.includes(m) || m.includes('lite') || m.includes('flash') || m.includes('mini') || m.includes('haiku')
  }

  return (
    <div className="flex items-center space-x-2" ref={dropdownRef}>
      {/* 1-Click Fast Light Mode Button */}
      <button
        onClick={() => onToggleLightMode(!isLightMode)}
        className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-md border transition ${
          isLightMode
            ? 'bg-amber-950/60 border-amber-600 text-amber-200 font-semibold shadow-sm shadow-amber-950/50'
            : 'bg-jarvis-elevated border-jarvis-border text-jarvis-muted hover:text-jarvis-ivory hover:border-jarvis-borderStrong'
        }`}
        title={isLightMode ? 'Light Mode is Active (~1.5s response)' : 'Switch to Fast Light Mode'}
      >
        <Zap className={`w-3.5 h-3.5 ${isLightMode ? 'text-amber-400 fill-amber-400' : 'text-jarvis-muted'}`} />
        <span>Light Mode</span>
        {isLightMode && (
          <span className="text-[10px] bg-amber-800 text-amber-100 px-1 rounded font-mono">ON</span>
        )}
      </button>

      {/* Model Picker Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-md bg-jarvis-surface border border-jarvis-border text-jarvis-sage hover:border-jarvis-accent hover:text-jarvis-ivory transition"
        >
          <Cpu className="w-3.5 h-3.5 text-jarvis-accentGlow" />
          <span className="font-mono text-[11px] max-w-[140px] truncate">
            {isLightMode ? 'gemini-flash-lite' : currentModel}
          </span>
          <ChevronDown className="w-3 h-3 text-jarvis-muted" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-jarvis-surface border border-jarvis-borderStrong rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-jarvis-border bg-jarvis-base">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-jarvis-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 270+ models..."
                  className="w-full bg-jarvis-surface border border-jarvis-border rounded pl-8 pr-3 py-1.5 text-xs text-jarvis-ivory placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1 divide-y divide-jarvis-border">
              {/* Recommended Light Models */}
              {!searchQuery && (
                <div className="p-1">
                  <div className="text-[10px] font-semibold text-amber-400/90 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Fast Light Models (Low Latency)</span>
                  </div>
                  {catalog.light.slice(0, 6).map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        onSelectModel(model)
                        setIsOpen(false)
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-jarvis-elevated text-left text-xs transition"
                    >
                      <span className="font-mono text-jarvis-sage text-[11px] truncate">{model}</span>
                      {currentModel === model && !isLightMode && (
                        <Check className="w-3.5 h-3.5 text-jarvis-accentGlow" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* All / Filtered Models */}
              <div className="p-1">
                <div className="text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-jarvis-accentGlow" />
                  <span>{searchQuery ? `Matching Models (${filteredAll.length})` : 'All Available Models'}</span>
                </div>
                {filteredAll.length === 0 ? (
                  <div className="text-center py-4 text-xs text-jarvis-muted">No models found</div>
                ) : (
                  filteredAll.slice(0, 30).map((model) => {
                    const light = isLight(model)
                    return (
                      <button
                        key={model}
                        onClick={() => {
                          onSelectModel(model)
                          setIsOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-jarvis-elevated text-left text-xs transition"
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="font-mono text-jarvis-sage text-[11px] truncate">{model}</span>
                          {light && (
                            <span className="text-[9px] bg-amber-950/70 border border-amber-800 text-amber-300 px-1 rounded">
                              fast
                            </span>
                          )}
                        </div>
                        {currentModel === model && !isLightMode && (
                          <Check className="w-3.5 h-3.5 text-jarvis-accentGlow flex-shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
