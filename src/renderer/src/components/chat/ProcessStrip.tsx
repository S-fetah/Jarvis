import React from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Globe, Square, Terminal } from 'lucide-react'
import type { ManagedProcess } from '../../../../shared/types'
import { Button } from '../ui'
import { cn } from '../../lib/cn'

interface ProcessStripProps {
  processes: ManagedProcess[]
  expandedLogsProcessId: string | null
  containerMaxWidth?: string
  onToggleLogs: (id: string) => void
  onStopProcess: (id: string) => void
  onOpenCanvas?: (url: string) => void
}

export function ProcessStrip({
  processes,
  expandedLogsProcessId,
  containerMaxWidth,
  onToggleLogs,
  onStopProcess,
  onOpenCanvas
}: ProcessStripProps): React.JSX.Element | null {
  if (processes.length === 0) return null

  return (
    <div className="shrink-0 border-b border-jarvis-border bg-jarvis-elevated/55 px-5 py-2.5">
      <div className={cn('mx-auto space-y-2 transition-all duration-200', containerMaxWidth || 'max-w-[1100px]')}>
        {processes.map((proc) => {
          const logsOpen = expandedLogsProcessId === proc.id
          return (
            <div key={proc.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jarvis-accent opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-jarvis-accent" />
                  </span>
                  <span className="text-3xs font-semibold uppercase tracking-[0.15em] text-jarvis-accent">
                    Live process
                  </span>
                </span>

                <code className="max-w-[300px] truncate rounded bg-jarvis-code px-2 py-1 font-mono text-[10.5px] text-jarvis-codeInk">
                  {proc.command}
                </code>

                {proc.port ? (
                  <div className="flex items-center gap-1.5">
                    {onOpenCanvas && (
                      <button
                        type="button"
                        onClick={() => onOpenCanvas(`http://localhost:${proc.port}`)}
                        className="inline-flex items-center gap-1 rounded bg-jarvis-accent px-2 py-1 font-mono text-[10px] font-semibold text-jarvis-accentContrast shadow transition hover:opacity-90"
                        title="Preview live in Jarvis Workspace Canvas"
                      >
                        <Globe className="h-2.5 w-2.5" />
                        Canvas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.jarvisAPI?.openExternalUrl(`http://localhost:${proc.port}`)}
                      className="inline-flex items-center gap-1.5 rounded border border-jarvis-accent/30 bg-jarvis-accentSoft px-2 py-1 font-mono text-[10px] text-jarvis-accent transition hover:border-jarvis-accent/60"
                      title="Open in external browser"
                    >
                      localhost:{proc.port}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <span className="rounded border border-jarvis-signal/30 bg-jarvis-signalSoft px-2 py-1 font-mono text-[10px] text-jarvis-signal">
                    detecting port…
                  </span>
                )}

                <span className="font-mono text-3xs text-jarvis-muted">PID {proc.pid}</span>

                <div className="ml-auto flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleLogs(proc.id)}
                    className="gap-1 text-[11px]"
                  >
                    <Terminal className="h-3 w-3" />
                    <span>Logs</span>
                    {logsOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onStopProcess(proc.id)}
                    className="gap-1 text-[11px] text-jarvis-danger hover:border-jarvis-danger/40 hover:text-jarvis-danger"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    <span>Stop</span>
                  </Button>
                </div>
              </div>

              {logsOpen && (
                <div className="rounded-lg border border-jarvis-border bg-jarvis-base p-3">
                  <div className="mb-1 flex items-center justify-between text-3xs text-jarvis-muted">
                    <span className="font-mono">Output stream (tail 100)</span>
                    <span className="font-mono">{proc.recentLogs ? proc.recentLogs.length : 0} lines</span>
                  </div>
                  <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-jarvis-ivory">
                    {proc.recentLogs && proc.recentLogs.length > 0
                      ? proc.recentLogs.slice(-100).join('\n')
                      : 'No output recorded yet.'}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
