import React from 'react'
import { cn } from '../../lib/cn'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  icon?: React.ReactNode
  trailing?: React.ReactNode
  containerClassName?: string
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  { className, containerClassName, label, hint, icon, trailing, id, ...props },
  ref
) {
  const generatedId = React.useId()
  const inputId = id || generatedId
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-2xs font-semibold uppercase tracking-[0.12em] text-jarvis-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-md border border-jarvis-border bg-jarvis-base px-3 text-[13px] text-jarvis-ivory',
            'placeholder:text-jarvis-muted/75 transition focus:border-jarvis-accent focus:bg-jarvis-surface focus:outline-none',
            'disabled:opacity-50',
            icon && 'pl-9',
            trailing && 'pr-10',
            className
          )}
          {...props}
        />
        {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {hint && <p className="text-[11px] leading-relaxed text-jarvis-muted">{hint}</p>}
    </div>
  )
})

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  containerClassName?: string
}

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ className, containerClassName, label, hint, id, ...props }, ref) {
    const generatedId = React.useId()
    const inputId = id || generatedId
    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-2xs font-semibold uppercase tracking-[0.12em] text-jarvis-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5 text-[13px] leading-relaxed text-jarvis-ivory',
            'placeholder:text-jarvis-muted/75 transition focus:border-jarvis-accent focus:bg-jarvis-surface focus:outline-none',
            className
          )}
          {...props}
        />
        {hint && <p className="text-[11px] leading-relaxed text-jarvis-muted">{hint}</p>}
      </div>
    )
  }
)
