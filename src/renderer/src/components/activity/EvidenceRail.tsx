import React, { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  FileOutput,
  FolderOpen,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X
} from 'lucide-react'
import type { TaskState, TimelineEvent } from '../../../../shared/types'
import { formatClock } from '../../lib/format'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton } from '../ui'
import { PlanCard } from '../chat/PlanCard'

interface EvidenceRailProps {
  timelineEvents: TimelineEvent[]
  taskState: TaskState | null
  outputDirectory: string
  onClose: () => void
}

type Tab = 'plan' | 'timeline'
type Filter = 'all' | 'tools' | 'approvals'

const eventIcon = {
  log: ScrollText,
  tool_call: Wrench,
  approval_prompt: ShieldAlert,
  approval_resolved: ShieldCheck,
  artifact_created: FileOutput,
  error: AlertTriangle
} as const

const eventTone = {
  log: 'text-jarvis-muted',
  tool_call: 'text-jarvis-info',
  approval_prompt: 'text-jarvis-signal',
  approval_resolved: 'text-jarvis-accent',
  artifact_created: 'text-jarvis-accent',
  error: 'text-jarvis-danger'
} as const

export function EvidenceRail({
  timelineEvents,
  taskState,
  outputDirectory,
  onClose
}: EvidenceRailProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(taskState ? 'plan' : 'timeline')
  const [filter, setFilter] = useState<Filter>('all')

  const filteredEvents = useMemo(() => {
    if (filter === 'tools') return timelineEvents.filter((event) => event.type === 'tool_call')
    if (filter === 'approvals') {
      return timelineEvents.filter(
        (event) => event.type === 'approval_prompt' || event.type === 'approval_resolved'
      )
    }
    return timelineEvents
  }, [timelineEvents, filter])

  const revealArtifact = (event: TimelineEvent): void => {
    const match = event.details?.match(/`([^`]+)`/)
    const target = match ? match[1] : outputDirectory
    window.jarvisAPI?.openPath(target)
  }

  return (
    <aside
      aria-label="Evidence and execution plan"
      className="flex w-[340px] shrink-0 flex-col border-l border-jarvis-border bg-jarvis-surface"
    >
      <div className="flex h-[62px] shrink-0 items-center gap-2 border-b border-jarvis-border px-4">
        <div className="min-w-0 flex-1">
          <p className="text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-muted">
            Audit trail
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <h2 className="font-display text-[18px] font-semibold leading-none text-jarvis-ivory">
              Evidence
            </h2>
            <Badge variant="outline" mono>
              {timelineEvents.length}
            </Badge>
          </div>
        </div>
        <IconButton label="Close evidence rail" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="shrink-0 border-b border-jarvis-border px-3 py-2">
        <div className="grid grid-cols-2 gap-0.5 rounded-md border border-jarvis-border bg-jarvis-base p-0.5">
          <button
            type="button"
            onClick={() => setTab('plan')}
            aria-pressed={tab === 'plan'}
            className={cn(
              'flex h-7 items-center justify-center gap-1.5 rounded text-[10.5px] font-medium transition',
              tab === 'plan'
                ? 'bg-jarvis-elevated text-jarvis-ivory shadow-hairline'
                : 'text-jarvis-muted hover:text-jarvis-sage'
            )}
          >
            <Activity className="h-3 w-3" />
            Plan
            {taskState && (
              <span className="font-mono text-[9px] text-jarvis-muted">{taskState.steps.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('timeline')}
            aria-pressed={tab === 'timeline'}
            className={cn(
              'flex h-7 items-center justify-center gap-1.5 rounded text-[10.5px] font-medium transition',
              tab === 'timeline'
                ? 'bg-jarvis-elevated text-jarvis-ivory shadow-hairline'
                : 'text-jarvis-muted hover:text-jarvis-sage'
            )}
          >
            <ScrollText className="h-3 w-3" />
            Timeline
            <span className="font-mono text-[9px] text-jarvis-muted">{timelineEvents.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'plan' ? (
          taskState ? (
            <PlanCard taskState={taskState} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
              <Activity className="mb-2.5 h-6 w-6 text-jarvis-borderStrong" />
              <p className="text-[11.5px] font-medium text-jarvis-sage">No active plan</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-jarvis-muted">
                When Jarvis breaks a request into steps, the execution plan will appear here.
              </p>
            </div>
          )
        ) : (
          <>
            <div className="mb-3 flex items-center gap-1">
              {(
                [
                  ['all', 'All'],
                  ['tools', 'Tools'],
                  ['approvals', 'Approvals']
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={cn(
                    'h-6 rounded-full border px-2 text-[9.5px] font-medium transition',
                    filter === value
                      ? 'border-jarvis-accent/30 bg-jarvis-accentSoft text-jarvis-accent'
                      : 'border-jarvis-border bg-jarvis-base text-jarvis-muted hover:text-jarvis-sage'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="flex h-[240px] flex-col items-center justify-center px-4 text-center">
                <ScrollText className="mb-2.5 h-6 w-6 text-jarvis-borderStrong" />
                <p className="text-[11.5px] font-medium text-jarvis-sage">Nothing recorded yet</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-jarvis-muted">
                  Tool calls, approvals, and artifacts will be logged here as the session unfolds.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-0">
                {filteredEvents.map((event, index) => {
                  const Icon = eventIcon[event.type]
                  return (
                    <li key={event.id} className="relative flex gap-2.5 pb-4 last:pb-0">
                      {index < filteredEvents.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[11px] top-6 h-[calc(100%-14px)] w-px bg-jarvis-border"
                        />
                      )}
                      <span
                        className={cn(
                          'relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-jarvis-border bg-jarvis-base',
                          eventTone[event.type]
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-medium leading-snug text-jarvis-ivory">
                            {event.title}
                          </p>
                          <time className="shrink-0 font-mono text-[9px] text-jarvis-muted/75">
                            {formatClock(event.timestamp)}
                          </time>
                        </div>
                        {event.details && (
                          <p className="mt-1 line-clamp-4 break-words text-[10px] leading-relaxed text-jarvis-muted">
                            {event.details}
                          </p>
                        )}
                        {event.type === 'artifact_created' && (
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => revealArtifact(event)}
                            className="mt-1.5 h-6 gap-1 px-1.5 text-[9.5px]"
                          >
                            <FolderOpen className="h-3 w-3" />
                            Reveal in Explorer
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-jarvis-border px-3.5 py-2.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-jarvis-accent" />
        <p className="text-[10px] leading-snug text-jarvis-muted">
          Evidence stays local. Approvals are bound to the exact action.
        </p>
      </div>
    </aside>
  )
}
