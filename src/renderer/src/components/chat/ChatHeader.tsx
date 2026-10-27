import React from 'react'
import { Activity, FolderOpen } from 'lucide-react'
import type { ModelCatalog, TaskStatus } from '../../../../shared/types'
import { basename } from '../../lib/format'
import { cn } from '../../lib/cn'
import { Badge, Button, Tooltip } from '../ui'
import { ModelSelector } from '../ModelSelector'

interface ChatHeaderProps {
  title: string
  workspacePath: string
  onSelectWorkspace: () => void
  currentModel: string
  lightMode: boolean
  catalog: ModelCatalog
  onSelectModel: (model: string) => void
  onToggleLightMode: (enabled: boolean) => void
  timelineOpen: boolean
  onToggleTimeline: () => void
  eventCount: number
  taskStatus?: TaskStatus
}

const statusLabel: Record<TaskStatus, string> = {
  idle: 'Idle',
  planning: 'Planning',
  running: 'Running',
  waiting_for_approval: 'Awaiting approval',
  verifying: 'Verifying',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

const statusVariant: Record<TaskStatus, 'neutral' | 'accent' | 'signal' | 'danger'> = {
  idle: 'neutral',
  planning: 'accent',
  running: 'accent',
  waiting_for_approval: 'signal',
  verifying: 'accent',
  completed: 'accent',
  failed: 'danger',
  cancelled: 'neutral'
}

export function ChatHeader({
  title,
  workspacePath,
  onSelectWorkspace,
  currentModel,
  lightMode,
  catalog,
  onSelectModel,
  onToggleLightMode,
  timelineOpen,
  onToggleTimeline,
  eventCount,
  taskStatus
}: ChatHeaderProps): React.JSX.Element {
  return (
    <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-jarvis-border bg-jarvis-base px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-muted">
            Field notes
          </span>
          {taskStatus && taskStatus !== 'idle' && (
            <Badge variant={statusVariant[taskStatus]} dot>
              {statusLabel[taskStatus]}
            </Badge>
          )}
        </div>
        <h1 className="mt-1 truncate font-display text-[19px] font-semibold leading-none tracking-[-0.02em] text-jarvis-ivory">
          {title || 'Untitled conversation'}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip label={workspacePath}>
          <button
            type="button"
            onClick={onSelectWorkspace}
            className="hidden h-8 max-w-[190px] items-center gap-1.5 rounded-md border border-jarvis-border bg-jarvis-elevated px-2.5 text-[10.5px] text-jarvis-sage transition hover:border-jarvis-borderStrong hover:text-jarvis-ivory lg:flex"
          >
            <FolderOpen className="h-3 w-3 shrink-0 text-jarvis-accent" />
            <span className="truncate font-mono">{basename(workspacePath)}</span>
          </button>
        </Tooltip>

        <ModelSelector
          currentModel={currentModel}
          isLightMode={lightMode}
          catalog={catalog}
          onSelectModel={onSelectModel}
          onToggleLightMode={onToggleLightMode}
        />

        <Button
          variant={timelineOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleTimeline}
          aria-pressed={timelineOpen}
          className={cn('gap-1.5', timelineOpen && 'border-jarvis-accent/35 text-jarvis-accent')}
        >
          <Activity className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Evidence</span>
          <span className="rounded-full bg-jarvis-base px-1.5 py-0.5 font-mono text-[9px] text-jarvis-muted">
            {eventCount}
          </span>
        </Button>
      </div>
    </header>
  )
}
