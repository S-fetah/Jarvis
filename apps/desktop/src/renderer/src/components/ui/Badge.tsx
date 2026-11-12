import React from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant = 'neutral' | 'accent' | 'signal' | 'danger' | 'outline' | 'ink'

const variants: Record<BadgeVariant, string> = {
  neutral: 'border-jarvis-border bg-jarvis-elevated text-jarvis-sage',
  accent: 'border-jarvis-accent/25 bg-jarvis-accentSoft text-jarvis-accent',
  signal: 'border-jarvis-signal/30 bg-jarvis-signalSoft text-jarvis-signal',
  danger: 'border-jarvis-danger/25 bg-jarvis-dangerSoft text-jarvis-danger',
  outline: 'border-jarvis-borderStrong bg-transparent text-jarvis-muted',
  ink: 'border-transparent bg-jarvis-ivory text-jarvis-base'
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  mono?: boolean
  dot?: boolean
}

export function Badge({
  className,
  variant = 'neutral',
  mono = false,
  dot = false,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium leading-none',
        mono && 'font-mono tracking-tight',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}
