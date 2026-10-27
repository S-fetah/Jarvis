import React, { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  MinusCircle,
  XCircle
} from 'lucide-react'
import type { PlanStep, TaskState, TaskStatus } from '../../../../shared/types'
import { cn } from '../../lib/cn'
import { Badge } from '../ui'

interface PlanCardProps {
  taskState: TaskState
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

function StepIcon({ step }: { step: PlanStep }): React.JSX.Element {
  if (step.status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5 text-jarvis-accent" />
  if (step.status === 'in_progress') return <CircleDot className="h-3.5 w-3.5 text-jarvis-signal" />
  if (step.status === 'failed') return <XCircle className="h-3.5 w-3.5 text-jarvis-danger" />
  if (step.status === 'skipped') return <MinusCircle className="h-3.5 w-3.5 text-jarvis-muted" />
  return <Circle className="h-3.5 w-3.5 text-jarvis-borderStrong" />
}

export function PlanCard({ taskState }: PlanCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const completed = taskState.steps.filter((step) => step.status === 'completed').length
  const total = taskState.steps.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <section className="animate-slide-up rounded-lg border border-jarvis-border bg-jarvis-surface shadow-hairline">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 rounded-t-lg px-4 py-3 text-left transition hover:bg-jarvis-elevated/55"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-jarvis-accent/25 bg-jarvis-accentSoft font-mono text-[10px] font-semibold text-jarvis-accent">
          {completed}/{total || 0}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.15em] text-jarvis-muted">
              Execution plan
            </span>
            <Badge variant={statusVariant[taskState.status]} dot>
              {statusLabel[taskState.status]}
            </Badge>
          </span>
          <span className="mt-1 block truncate text-[12.5px] font-medium text-jarvis-ivory">
            {taskState.goal}
          </span>
        </span>
        <span className="mt-0.5 text-jarvis-muted">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-jarvis-border px-4 pb-3.5 pt-3">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-jarvis-hover">
              <div
                className="h-full rounded-full bg-jarvis-accent transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-3xs text-jarvis-muted">{progress}%</span>
          </div>

          <ol className="space-y-0">
            {taskState.steps.map((step, index) => {
              const active = step.id === taskState.activeStepId
              return (
                <li key={step.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                  {index < taskState.steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[6.75px] top-4 h-[calc(100%-4px)] w-px bg-jarvis-border"
                    />
                  )}
                  <span className="relative z-10 mt-0.5 bg-jarvis-surface">
                    <StepIcon step={step} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-[11.5px] leading-tight',
                          active ? 'font-semibold text-jarvis-ivory' : 'text-jarvis-sage'
                        )}
                      >
                        {step.title}
                      </span>
                      {active && (
                        <span className="shrink-0 rounded-full border border-jarvis-signal/30 bg-jarvis-signalSoft px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-jarvis-signal">
                          now
                        </span>
                      )}
                    </span>
                    {step.description && (
                      <span className="mt-0.5 block line-clamp-2 text-[10.5px] leading-snug text-jarvis-muted">
                        {step.description}
                      </span>
                    )}
                    {step.error && (
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-jarvis-danger">
                        {step.error}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 shrink-0 font-mono text-3xs text-jarvis-muted/70">
                    {step.category.replace('_', ' ')}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
