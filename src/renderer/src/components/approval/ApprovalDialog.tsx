import React, { useState } from 'react'
import { Check, Copy, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react'
import type { ApprovalRequest } from '../../../../shared/types'
import { Button, Dialog, DialogContent } from '../ui'

interface ApprovalDialogProps {
  approval: ApprovalRequest | null
  onResolve: (approval: ApprovalRequest, decision: 'granted' | 'denied') => void
}

export function ApprovalDialog({ approval, onResolve }: ApprovalDialogProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copyCommand = async (): Promise<void> => {
    if (!approval?.command) return
    try {
      await navigator.clipboard.writeText(approval.command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access is best-effort.
    }
  }

  return (
    <Dialog open={Boolean(approval)} onOpenChange={() => undefined}>
      {approval && (
        <DialogContent
          role="alertdialog"
          aria-labelledby="approval-title"
          aria-describedby="approval-description"
          showClose={false}
          size="md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="border-jarvis-signal/35"
        >
          <div className="flex items-start gap-3 border-b border-jarvis-border bg-jarvis-signalSoft/55 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-jarvis-signal/30 bg-jarvis-surface text-jarvis-signal">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-3xs font-semibold uppercase tracking-[0.18em] text-jarvis-signal">
                ADR-004 · Explicit approval
              </p>
              <h2
                id="approval-title"
                className="mt-1 font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-jarvis-ivory"
              >
                {approval.title || 'Action requires approval'}
              </h2>
              <p id="approval-description" className="mt-1 text-[11.5px] leading-relaxed text-jarvis-sage">
                Assistive autonomy has paused. Review the exact action below, then approve or deny it.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-jarvis-signal/30 bg-jarvis-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-jarvis-signal">
              {approval.category.replace('_', ' ')}
            </span>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-2xs font-semibold uppercase tracking-[0.13em] text-jarvis-muted">
                  Exact command · verify before approving
                </span>
                {approval.command && (
                  <button
                    type="button"
                    onClick={copyCommand}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-jarvis-muted transition hover:bg-jarvis-hover hover:text-jarvis-ivory"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-jarvis-accent" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="code-well select-text rounded-md border border-jarvis-border p-3">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-jarvis-codeInk/55">
                  <Terminal className="h-3 w-3" />
                  {approval.command ? 'powershell / system' : approval.actionType}
                </div>
                <code className="block max-h-40 overflow-y-auto break-all font-mono text-[11.5px] leading-relaxed text-jarvis-codeInk">
                  {approval.command || approval.actionType}
                </code>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-jarvis-border bg-jarvis-base p-2.5">
                <span className="block text-3xs font-semibold uppercase tracking-[0.14em] text-jarvis-muted">
                  Target directory
                </span>
                <code className="mt-1 block break-all font-mono text-[10.5px] leading-relaxed text-jarvis-sage">
                  {approval.workingDirectory || approval.workspacePath}
                </code>
              </div>
              {approval.targetPath && (
                <div className="rounded-md border border-jarvis-border bg-jarvis-base p-2.5">
                  <span className="block text-3xs font-semibold uppercase tracking-[0.14em] text-jarvis-muted">
                    Target path
                  </span>
                  <code className="mt-1 block break-all font-mono text-[10.5px] leading-relaxed text-jarvis-sage">
                    {approval.targetPath}
                  </code>
                </div>
              )}
            </div>

            {approval.explanation && (
              <div className="rounded-md border border-jarvis-border bg-jarvis-elevated/60 p-3">
                <span className="block text-3xs font-semibold uppercase tracking-[0.14em] text-jarvis-muted">
                  Purpose
                </span>
                <p className="mt-1 text-[11.5px] leading-relaxed text-jarvis-sage">{approval.explanation}</p>
              </div>
            )}

            {approval.safetyImpact && (
              <div className="rounded-md border border-jarvis-signal/20 bg-jarvis-signalSoft/35 p-3">
                <span className="block text-3xs font-semibold uppercase tracking-[0.14em] text-jarvis-signal">
                  Safety & process impact
                </span>
                <p className="mt-1 text-[11.5px] leading-relaxed text-jarvis-sage">{approval.safetyImpact}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-jarvis-border bg-jarvis-base px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-[10px] leading-snug text-jarvis-muted">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-jarvis-accent" />
              Approving executes this exact action once. It does not create a global allow.
            </p>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button
                variant="dangerGhost"
                size="md"
                onClick={() => onResolve(approval, 'denied')}
                className="min-w-[86px]"
              >
                Deny
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => onResolve(approval, 'granted')}
                className="min-w-[132px]"
              >
                Approve & execute
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
