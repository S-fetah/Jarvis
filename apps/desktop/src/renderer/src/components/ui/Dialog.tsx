import * as DialogPrimitive from '@radix-ui/react-dialog'
import { RotateCcw, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

/**
 * Computes boundary-clamped drag coordinates ensuring the dialog never escapes the viewport.
 * Uses a safe minimum margin so the modal and its controls remain visible and accessible.
 */
export function clampDialogCoordinates(
  desiredX: number,
  desiredY: number,
  modalWidth: number,
  modalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  // If viewport is smaller than modal, clamp to 0 (centered) so internal scrolling handles it
  const maxOffsetX = Math.max(0, (viewportWidth - modalWidth) / 2 - 12)
  const maxOffsetY = Math.max(0, (viewportHeight - modalHeight) / 2 - 12)

  return {
    x: Math.round(Math.max(-maxOffsetX, Math.min(maxOffsetX, desiredX))),
    y: Math.round(Math.max(-maxOffsetY, Math.min(maxOffsetY, desiredY)))
  }
}

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof sizes
  showClose?: boolean
  closeLabel?: string
  draggable?: boolean
  onPositionReset?: () => void
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  {
    className,
    children,
    size = 'md',
    showClose = true,
    closeLabel = 'Close dialog',
    draggable = true,
    onPositionReset,
    ...props
  },
  forwardedRef
) {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const originPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Merge forwarded ref and local contentRef
  const setRef = (node: HTMLDivElement | null): void => {
    contentRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      ;(forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }

  // Reset position to center whenever modal mounts
  useEffect(() => {
    setPosition({ x: 0, y: 0 })
  }, [])

  // Auto-clamp when window is resized so modal doesn't get left outside
  useEffect(() => {
    const handleResize = (): void => {
      if (!contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      setPosition((prev) =>
        clampDialogCoordinates(
          prev.x,
          prev.y,
          rect.width,
          rect.height,
          window.innerWidth,
          window.innerHeight
        )
      )
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggable || e.button !== 0) return // Left click only

    const target = e.target as HTMLElement
    // Ignore interactive controls
    if (target.closest('button, input, textarea, select, a, .no-drag, [data-no-drag="true"]')) {
      return
    }

    // Only allow drag initiation from header area or drag-handle
    const isDragArea =
      target.closest('[data-drag-handle="true"]') ||
      target.closest('.dialog-header') ||
      target.closest('header')

    if (!isDragArea) {
      // Check if clicking within top 54px of the content box (safe top zone)
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect()
        if (e.clientY - rect.top > 54) return
      } else {
        return
      }
    }

    isDraggingRef.current = true
    setIsDragging(true)
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    originPosRef.current = { ...position }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDraggingRef.current || !contentRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y

    const rect = contentRef.current.getBoundingClientRect()
    const clamped = clampDialogCoordinates(
      originPosRef.current.x + dx,
      originPosRef.current.y + dy,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight
    )

    setPosition(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Best-effort release
    }
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, select, a, .no-drag, [data-no-drag="true"]')) {
      return
    }
    const isDragArea =
      target.closest('[data-drag-handle="true"]') ||
      target.closest('.dialog-header') ||
      target.closest('header')
    if (isDragArea) {
      setPosition({ x: 0, y: 0 })
      onPositionReset?.()
    }
  }

  const isMoved = position.x !== 0 || position.y !== 0

  return (
    <DialogPrimitive.Portal>
      {/* Backdrop Overlay */}
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-[#0d1411]/60 backdrop-blur-[3px]',
          'data-[state=open]:animate-fade-in'
        )}
      />

      {/* Centering Flexbox Shell (Guarantees perfect center in any window size) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none overflow-hidden">
        <DialogPrimitive.Content
          ref={setRef}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          className={cn(
            'pointer-events-auto relative flex max-h-[calc(100vh-2.5rem)] w-[calc(100vw-2rem)]',
            'flex-col overflow-hidden rounded-xl border border-jarvis-borderStrong bg-jarvis-surface shadow-floating',
            'focus:outline-none transition-shadow duration-150',
            isDragging && 'shadow-2xl ring-2 ring-jarvis-accent/50 select-none cursor-grabbing',
            sizes[size],
            className
          )}
          {...props}
        >
          {children}

          {/* Top-Right Action Controls (Re-center & Close) */}
          <div className="absolute right-3.5 top-3.5 z-20 flex items-center gap-1 no-drag">
            {isMoved && (
              <button
                type="button"
                onClick={() => {
                  setPosition({ x: 0, y: 0 })
                  onPositionReset?.()
                }}
                title="Re-center modal (or double-click header)"
                aria-label="Re-center modal"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-jarvis-muted transition hover:bg-jarvis-hover hover:text-jarvis-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {showClose && (
              <DialogPrimitive.Close
                aria-label={closeLabel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-jarvis-muted transition hover:bg-jarvis-hover hover:text-jarvis-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jarvis-accent"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            )}
          </div>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  )
})

export const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { showGrip?: boolean }
>(function DialogHeader({ className, children, showGrip = true, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-drag-handle="true"
      className={cn(
        'dialog-header relative flex shrink-0 items-start justify-between gap-4 border-b border-jarvis-border bg-jarvis-surface px-5 py-4 cursor-grab active:cursor-grabbing select-none',
        className
      )}
      title="Drag to reposition · Double-click to re-center"
      {...props}
    >
      {showGrip && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
        >
          <div className="h-1 w-10 rounded-full bg-jarvis-muted" />
        </div>
      )}
      {children}
    </div>
  )
})

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-xl font-semibold tracking-tight text-jarvis-ivory', className)}
      {...props}
    />
  )
})

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-[12.5px] leading-relaxed text-jarvis-muted', className)}
      {...props}
    />
  )
})
