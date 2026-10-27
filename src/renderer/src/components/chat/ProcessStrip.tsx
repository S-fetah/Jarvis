import React from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Square, Terminal } from 'lucide-react'
import type { ManagedProcess } from '../../../../shared/types'
import { Button } from '../ui'

interface ProcessStripProps {
  processes: ManagedProcess[]
  expandedLogsProcessId: string | null
  onToggleLogs: (id: string) => void
  onStopProcess: (id: string) => void
}

export function ProcessStrip({
  processes,
  expandedLogsProcessId,
  onToggleLogs,
  onStopProcess
}: ProcessStripProps): React.JSX.Element | null {
  if (processes.length === 0) return null

  return (
    <div className="shrink-0 border-b border-jarvis-border bg-jarvis-elevated/55 px-5 py-2.5">
      <div className="mx-auto max-w-[860px] space-y-2">
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
                  <button
                    type="button"
                    onClick={() => window.jarvisAPI?.openExternalUrl(`http://localhost:${proc.port}`)}
                    className="inline-flex items-center gap-1.5 rounded border border-jarvis-accent/30 bg-jarvis-accentSoft px-2 py-1 font-mono text-[10px] text-jarvis-accent transition hover:border-jarvis-accent/60"
                    title="Open in browser"
                  >
                    localhost:{proc.port}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
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
                    aria-expanded={logsOpen}
                    className="h-7 gap-1 px-2 text-[10.5px]"
                  >
                    <Terminal className="h-3 w-3" />
                    Logs
                    {logsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    onClick={() => onStopProcess(proc.id)}
                    className="h-7 gap-1 px-2 text-[10.5px]"
                    title="Stop development server"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    Stop
                  </Button>
                </div>
              </div>

              {logsOpen && (
                <div className="code-well max-h-44 select-text overflow-y-auto rounded-md border border-jarvis-border p-2.5 font-mono text-[10.5px] leading-relaxed">
                  {proc.recentLogs.length === 0 ? (
                    <p className="italic text-jarvis-codeInk/55">Waiting for console output…</p>
                  ) : (
                    proc.recentLogs.map((line, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
