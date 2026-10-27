import React from 'react'
import { cn } from '../../lib/cn'

interface JarvisMarkProps {
  className?: string
  title?: string
}

/**
 * The Jarvis sigil: a watchful owl reduced to two hooded eyes and a beak,
 * framed by an observatory ring. It is deliberately geometric so it holds up
 * at 16px in the titlebar and at 56px in the welcome view.
 */
export function JarvisMark({ className, title }: JarvisMarkProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
    >
      <circle cx="20" cy="20" r="18.25" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" />
      <path
        d="M8.6 16.4c0-3.6 2.9-6.5 6.5-6.5 2.2 0 4 1.8 4 4v5.4H11.7c-1.7 0-3.1-1.3-3.1-2.9Z"
        fill="currentColor"
      />
      <path
        d="M31.4 16.4c0-3.6-2.9-6.5-6.5-6.5-2.2 0-4 1.8-4 4v5.4h7.4c1.7 0 3.1-1.3 3.1-2.9Z"
        fill="currentColor"
        fillOpacity="0.58"
      />
      <circle cx="15.1" cy="15.9" r="1.65" fill="var(--jarvis-surface)" />
      <circle cx="24.9" cy="15.9" r="1.65" fill="var(--jarvis-surface)" />
      <path d="M20 21.6l3.1 4.1-3.1 3.6-3.1-3.6 3.1-4.1Z" fill="currentColor" />
      <path d="M13.2 27.8c2.2 1.7 4.5 2.5 6.8 2.5s4.6-.8 6.8-2.5" stroke="currentColor" strokeOpacity="0.38" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
