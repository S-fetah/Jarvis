import React from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'quiet'
  | 'signal'
  | 'danger'
  | 'dangerGhost'

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'iconSm'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-jarvis-accent text-jarvis-accentContrast shadow-hairline hover:bg-jarvis-accentHover active:translate-y-px',
  secondary:
    'border border-jarvis-border bg-jarvis-elevated text-jarvis-ivory shadow-hairline hover:border-jarvis-borderStrong hover:bg-jarvis-hover active:translate-y-px',
  ghost:
    'text-jarvis-sage hover:bg-jarvis-hover hover:text-jarvis-ivory active:translate-y-px',
  quiet:
    'border border-transparent bg-transparent text-jarvis-muted hover:border-jarvis-border hover:bg-jarvis-elevated hover:text-jarvis-ivory',
  signal:
    'bg-jarvis-signal text-jarvis-signalContrast shadow-hairline hover:brightness-105 active:translate-y-px',
  danger:
    'bg-jarvis-danger text-jarvis-dangerContrast shadow-hairline hover:brightness-105 active:translate-y-px',
  dangerGhost:
    'border border-jarvis-danger/35 bg-jarvis-dangerSoft/50 text-jarvis-danger hover:bg-jarvis-dangerSoft active:translate-y-px'
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium',
  md: 'h-9 gap-2 rounded-md px-3.5 text-[13px] font-medium',
  lg: 'h-11 gap-2 rounded-lg px-5 text-sm font-semibold',
  icon: 'h-8 w-8 rounded-md',
  iconSm: 'h-7 w-7 rounded-md'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  active?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, variant = 'quiet', size = 'md', active = false, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-8 w-8 rounded-md' : 'h-7 w-7 rounded-md',
        active
          ? 'border border-jarvis-accent/35 bg-jarvis-accentSoft text-jarvis-accent'
          : variants[variant],
        className
      )}
      {...props}
    />
  )
})
