import React from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  BookOpen,
  Brain,
  Bug,
  Check,
  ChevronDown,
  Compass,
  Hammer,
  MessageSquare,
  Scale,
  Sparkles,
  Zap
} from 'lucide-react'
import type { TalkingStyle, TaskMode, ThinkingDepth } from '../../../shared/types'
import { cn } from '../lib/cn'

interface PromptControlsBarProps {
  talkingStyle: TalkingStyle
  taskMode: TaskMode
  thinkingDepth: ThinkingDepth
  onStyleChange: (style: TalkingStyle) => void
  onModeChange: (mode: TaskMode) => void
  onDepthChange: (depth: ThinkingDepth) => void
  compact?: boolean
}

const modeConfig = {
  chat: { label: 'Chat', icon: MessageSquare, desc: 'General companion & quick answers' },
  debug: { label: 'Debug', icon: Bug, desc: 'Isolate root causes & propose fixes' },
  build: { label: 'Build', icon: Hammer, desc: 'Production-ready code & architecture' },
  plan: { label: 'Plan', icon: Compass, desc: 'Roadmaps, milestones & dependencies' }
} satisfies Record<TaskMode, { label: string; icon: React.ElementType; desc: string }>

const styleConfig = {
  direct: { label: 'Direct', icon: Zap, desc: 'Laser-focused, minimal text' },
  balanced: { label: 'Balanced', icon: Scale, desc: 'Clear explanation & direct solution' },
  detailed: { label: 'Detailed', icon: BookOpen, desc: 'Comprehensive step-by-step dive' }
} satisfies Record<TalkingStyle, { label: string; icon: React.ElementType; desc: string }>

const depthConfig = {
  quick: { label: 'Quick', icon: Zap, desc: 'Brief reasoning (1–2 sentences)' },
  standard: { label: 'Standard', icon: Brain, desc: 'Balanced step-by-step thinking' },
  deep: { label: 'Deep', icon: Sparkles, desc: 'Exhaustive multi-angle reasoning' }
} satisfies Record<ThinkingDepth, { label: string; icon: React.ElementType; desc: string }>

interface ControlMenuProps<T extends string> {
  label: string
  value: T
  options: Record<T, { label: string; icon: React.ElementType; desc: string }>
  onChange: (value: T) => void
  compact: boolean
  align?: 'start' | 'end'
}

function ControlMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  compact,
  align = 'start'
}: ControlMenuProps<T>): React.JSX.Element {
  const current = options[value]
  const CurrentIcon = current?.icon || MessageSquare

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={`${label}: ${current?.label}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-transparent text-jarvis-muted transition',
            'hover:border-jarvis-border hover:bg-jarvis-elevated hover:text-jarvis-ivory',
            'data-[state=open]:border-jarvis-border data-[state=open]:bg-jarvis-elevated data-[state=open]:text-jarvis-ivory',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent',
            compact ? 'h-7 px-2 text-[10.5px]' : 'h-8 px-2.5 text-[11.5px]'
          )}
        >
          <CurrentIcon className={cn('shrink-0 text-jarvis-accent', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span className="font-medium">{current?.label}</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align={align}
          sideOffset={7}
          collisionPadding={12}
          className="z-[70] w-60 animate-scale-in rounded-lg border border-jarvis-borderStrong bg-jarvis-surface p-1 shadow-floating focus:outline-none"
        >
          <div className="px-2 py-1.5 text-3xs font-semibold uppercase tracking-[0.15em] text-jarvis-muted">
            {label}
          </div>
          <div className="space-y-0.5">
            {(Object.keys(options) as T[]).map((key) => {
              const option = options[key]
              const Icon = option.icon
              const selected = key === value
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(key)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition',
                    selected
                      ? 'bg-jarvis-accentSoft text-jarvis-ivory'
                      : 'text-jarvis-sage hover:bg-jarvis-hover hover:text-jarvis-ivory'
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      selected ? 'text-jarvis-accent' : 'text-jarvis-muted'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-medium leading-tight">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-jarvis-muted">
                      {option.desc}
                    </span>
                  </span>
                  {selected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jarvis-accent" />}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function PromptControlsBar({
  talkingStyle,
  taskMode,
  thinkingDepth,
  onStyleChange,
  onModeChange,
  onDepthChange,
  compact = false
}: PromptControlsBarProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex select-none items-center gap-0.5 overflow-x-auto no-scrollbar',
        compact ? 'text-[10.5px]' : 'text-[11.5px]'
      )}
      role="toolbar"
      aria-label="Response controls"
    >
      <ControlMenu
        label="Assistant mode"
        value={taskMode}
        options={modeConfig}
        onChange={onModeChange}
        compact={compact}
      />
      <span className="h-3 w-px shrink-0 bg-jarvis-border" aria-hidden="true" />
      <ControlMenu
        label="Talking style"
        value={talkingStyle}
        options={styleConfig}
        onChange={onStyleChange}
        compact={compact}
      />
      <span className="h-3 w-px shrink-0 bg-jarvis-border" aria-hidden="true" />
      <ControlMenu
        label="Reasoning depth"
        value={thinkingDepth}
        options={depthConfig}
        onChange={onDepthChange}
        compact={compact}
      />
    </div>
  )
}
