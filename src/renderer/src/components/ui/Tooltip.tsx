import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import React from 'react'
import { cn } from '../../lib/cn'

export function TooltipProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={450} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

interface TooltipProps {
  label: string
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function Tooltip({ label, children, side = 'bottom', align = 'center' }: TooltipProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-[80] max-w-64 rounded-md border border-jarvis-borderStrong bg-jarvis-ivory px-2.5 py-1.5',
            'font-sans text-[11px] font-medium leading-snug text-jarvis-base shadow-floating',
            'animate-fade-in data-[state=closed]:opacity-0'
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-jarvis-ivory" width={8} height={4} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
