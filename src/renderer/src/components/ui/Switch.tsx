import * as SwitchPrimitive from '@radix-ui/react-switch'
import React from 'react'
import { cn } from '../../lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  disabled?: boolean
  label: string
}

export function Switch({ checked, onCheckedChange, id, disabled, label }: SwitchProps): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent',
        'disabled:opacity-45',
        checked
          ? 'border-jarvis-accent/45 bg-jarvis-accent'
          : 'border-jarvis-borderStrong bg-jarvis-hover'
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block h-3 w-3 rounded-full bg-jarvis-surface shadow-sm transition-transform',
          checked ? 'translate-x-[15px]' : 'translate-x-[2px]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}
