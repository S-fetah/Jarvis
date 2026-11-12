import React from 'react'
import { cn } from '../../lib/cn'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-jarvis-border bg-jarvis-elevated px-1.5',
        'font-mono text-[10px] font-medium text-jarvis-muted shadow-[inset_0_-1px_0_var(--jarvis-border)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}

export function Divider({ className, label }: { className?: string; label?: string }): React.JSX.Element {
  if (!label) return <div className={cn('h-px w-full bg-jarvis-border', className)} />
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-px flex-1 bg-jarvis-border" />
      <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-jarvis-muted">{label}</span>
      <div className="h-px flex-1 bg-jarvis-border" />
    </div>
  )
}

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent',
        className
      )}
    />
  )
}
