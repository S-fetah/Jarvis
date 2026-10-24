import React, { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Bug,
  Hammer,
  Compass,
  Zap,
  Scale,
  BookOpen,
  Brain,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import { TalkingStyle, TaskMode, ThinkingDepth } from '../../../shared/types'

interface PromptControlsBarProps {
  talkingStyle: TalkingStyle
  taskMode: TaskMode
  thinkingDepth: ThinkingDepth
  onStyleChange: (style: TalkingStyle) => void
  onModeChange: (mode: TaskMode) => void
  onDepthChange: (depth: ThinkingDepth) => void
  compact?: boolean
}

export const PromptControlsBar: React.FC<PromptControlsBarProps> = ({
  talkingStyle,
  taskMode,
  thinkingDepth,
  onStyleChange,
  onModeChange,
  onDepthChange,
  compact = false
}) => {
  const [openMenu, setOpenMenu] = useState<'mode' | 'style' | 'depth' | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const modeConfig = {
    chat: { label: 'Chat', icon: MessageSquare, desc: 'General companion & quick answers' },
    debug: { label: 'Debug', icon: Bug, desc: 'Isolate root causes & propose fixes' },
    build: { label: 'Build', icon: Hammer, desc: 'Production-ready code & architecture' },
    plan: { label: 'Plan', icon: Compass, desc: 'Roadmaps, milestones & dependencies' }
  }

  const styleConfig = {
    direct: { label: 'Direct', icon: Zap, desc: 'Laser-focused, minimal text' },
    balanced: { label: 'Balanced', icon: Scale, desc: 'Clear explanation & direct solution' },
    detailed: { label: 'Detailed', icon: BookOpen, desc: 'Comprehensive step-by-step dive' }
  }

  const depthConfig = {
    quick: { label: 'Quick', icon: Zap, desc: 'Brief reasoning (1-2 sentences)' },
    standard: { label: 'Standard', icon: Brain, desc: 'Balanced step-by-step thinking' },
    deep: { label: 'Deep', icon: Sparkles, desc: 'Exhaustive multi-angle reasoning' }
  }

  const CurrentModeIcon = modeConfig[taskMode]?.icon || MessageSquare
  const CurrentStyleIcon = styleConfig[talkingStyle]?.icon || Scale
  const CurrentDepthIcon = depthConfig[thinkingDepth]?.icon || Brain

  return (
    <div
      ref={barRef}
      className={`flex items-center space-x-1.5 pb-2 select-none ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      {/* 1. Task Mode Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'mode' ? null : 'mode')}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-jarvis-base/70 hover:bg-jarvis-border/50 border border-jarvis-border text-jarvis-ivory transition shadow-sm"
          title="Select Assistant Mode"
        >
          <CurrentModeIcon className="w-3.5 h-3.5 text-jarvis-accent" />
          <span className="font-medium">{modeConfig[taskMode]?.label}</span>
          <ChevronDown className="w-3 h-3 text-jarvis-muted" />
        </button>

        {openMenu === 'mode' && (
          <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-jarvis-surface border border-jarvis-border rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider border-b border-jarvis-border/50 mb-1">
              Assistant Mode
            </div>
            {(Object.keys(modeConfig) as TaskMode[]).map((m) => {
              const ItemIcon = modeConfig[m].icon
              const isSelected = taskMode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onModeChange(m)
                    setOpenMenu(null)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-start space-x-2 transition ${
                    isSelected
                      ? 'bg-jarvis-accent/15 text-jarvis-accent font-semibold'
                      : 'hover:bg-jarvis-border/40 text-jarvis-ivory'
                  }`}
                >
                  <ItemIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs leading-none">{modeConfig[m].label}</div>
                    <div className="text-[10px] text-jarvis-muted leading-tight mt-0.5">
                      {modeConfig[m].desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Talking Style Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'style' ? null : 'style')}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-jarvis-base/70 hover:bg-jarvis-border/50 border border-jarvis-border text-jarvis-ivory transition shadow-sm"
          title="Select Response Style"
        >
          <CurrentStyleIcon className="w-3.5 h-3.5 text-jarvis-sage" />
          <span className="font-medium">{styleConfig[talkingStyle]?.label}</span>
          <ChevronDown className="w-3 h-3 text-jarvis-muted" />
        </button>

        {openMenu === 'style' && (
          <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-jarvis-surface border border-jarvis-border rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider border-b border-jarvis-border/50 mb-1">
              Talking Style
            </div>
            {(Object.keys(styleConfig) as TalkingStyle[]).map((s) => {
              const ItemIcon = styleConfig[s].icon
              const isSelected = talkingStyle === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStyleChange(s)
                    setOpenMenu(null)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-start space-x-2 transition ${
                    isSelected
                      ? 'bg-jarvis-sage/15 text-jarvis-sage font-semibold'
                      : 'hover:bg-jarvis-border/40 text-jarvis-ivory'
                  }`}
                >
                  <ItemIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs leading-none">{styleConfig[s].label}</div>
                    <div className="text-[10px] text-jarvis-muted leading-tight mt-0.5">
                      {styleConfig[s].desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Thinking Depth Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'depth' ? null : 'depth')}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-jarvis-base/70 hover:bg-jarvis-border/50 border border-jarvis-border text-jarvis-ivory transition shadow-sm"
          title="Select Reasoning Depth"
        >
          <CurrentDepthIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium">{depthConfig[thinkingDepth]?.label}</span>
          <ChevronDown className="w-3 h-3 text-jarvis-muted" />
        </button>

        {openMenu === 'depth' && (
          <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-jarvis-surface border border-jarvis-border rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[10px] font-semibold text-jarvis-muted uppercase tracking-wider border-b border-jarvis-border/50 mb-1">
              Reasoning Depth
            </div>
            {(Object.keys(depthConfig) as ThinkingDepth[]).map((d) => {
              const ItemIcon = depthConfig[d].icon
              const isSelected = thinkingDepth === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onDepthChange(d)
                    setOpenMenu(null)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-start space-x-2 transition ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-400 font-semibold'
                      : 'hover:bg-jarvis-border/40 text-jarvis-ivory'
                  }`}
                >
                  <ItemIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs leading-none">{depthConfig[d].label}</div>
                    <div className="text-[10px] text-jarvis-muted leading-tight mt-0.5">
                      {depthConfig[d].desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
