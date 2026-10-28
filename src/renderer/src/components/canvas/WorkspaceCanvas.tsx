import React, { useEffect, useState } from 'react'
import {
  ExternalLink,
  Globe,
  FileText,
  Laptop,
  RotateCw,
  Smartphone,
  X,
  Code2
} from 'lucide-react'
import { IconButton, Spinner, Tooltip } from '../ui'
import { cn } from '../../lib/cn'

export interface CanvasState {
  open: boolean
  type: 'browser' | 'pdf' | 'preview'
  url: string
  title: string
  dataUrl?: string
  filePath?: string
}

interface WorkspaceCanvasProps {
  canvasState: CanvasState
  onClose: () => void
  onUpdateState: (updates: Partial<CanvasState>) => void
  onOpenExternal: (url: string) => void
}

export function WorkspaceCanvas({
  canvasState,
  onClose,
  onUpdateState,
  onOpenExternal
}: WorkspaceCanvasProps): React.JSX.Element | null {
  const [addressInput, setAddressInput] = useState(canvasState.url)
  const [isLoading, setIsLoading] = useState(false)
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setAddressInput(canvasState.url)
    setIsLoading(Boolean(canvasState.url || canvasState.dataUrl))
  }, [canvasState.url, canvasState.dataUrl])

  if (!canvasState.open) return null

  const handleNavigate = (e: React.FormEvent): void => {
    e.preventDefault()
    let target = addressInput.trim()
    if (!target) return
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('localhost')) {
      if (target.includes(':') || target.includes('.')) {
        target = `http://${target}`
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`
      }
    } else if (target.startsWith('localhost')) {
      target = `http://${target}`
    }
    setAddressInput(target)
    onUpdateState({ url: target, type: 'browser', title: target })
    setRefreshKey((k) => k + 1)
  }

  const handleReload = (): void => {
    setIsLoading(true)
    setRefreshKey((k) => k + 1)
  }

  const isPdf = canvasState.type === 'pdf' || canvasState.url.toLowerCase().endsWith('.pdf')
  const activeUrl = canvasState.dataUrl || canvasState.url

  return (
    <aside className="relative flex h-full min-w-[380px] flex-1 flex-col border-l border-jarvis-border bg-jarvis-surface shadow-2xl transition-all duration-200">
      {/* Canvas Top Bar */}
      <div className="flex h-[48px] shrink-0 items-center gap-2 border-b border-jarvis-border bg-jarvis-elevated/70 px-3">
        <div className="flex items-center gap-1.5 text-jarvis-ivory">
          {isPdf ? (
            <FileText className="h-4 w-4 text-jarvis-accent" />
          ) : canvasState.type === 'preview' ? (
            <Code2 className="h-4 w-4 text-jarvis-accent" />
          ) : (
            <Globe className="h-4 w-4 text-jarvis-accent" />
          )}
          <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-wider text-jarvis-muted sm:inline">
            Canvas
          </span>
        </div>

        {/* Address / URL Bar */}
        <form onSubmit={handleNavigate} className="flex min-w-0 flex-1 items-center">
          <div className="relative flex w-full items-center">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Enter URL (e.g. http://localhost:5173) or file path..."
              className="h-7 w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 font-mono text-[11px] text-jarvis-ivory placeholder-jarvis-muted/60 transition focus:border-jarvis-accent/60 focus:outline-none focus:ring-1 focus:ring-jarvis-accent/30"
            />
          </div>
        </form>

        {/* Top Bar Action Buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label="Reload canvas">
            <IconButton label="Reload" size="sm" onClick={handleReload}>
              <RotateCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin text-jarvis-accent')} />
            </IconButton>
          </Tooltip>

          <Tooltip label={deviceMode === 'desktop' ? 'Switch to mobile view' : 'Switch to desktop view'}>
            <IconButton
              label="Toggle Device View"
              size="sm"
              onClick={() => setDeviceMode((m) => (m === 'desktop' ? 'mobile' : 'desktop'))}
            >
              {deviceMode === 'desktop' ? (
                <Smartphone className="h-3.5 w-3.5" />
              ) : (
                <Laptop className="h-3.5 w-3.5 text-jarvis-accent" />
              )}
            </IconButton>
          </Tooltip>

          {canvasState.url && (
            <Tooltip label="Open in external Chrome">
              <IconButton
                label="Open external"
                size="sm"
                onClick={() => onOpenExternal(canvasState.url)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip label="Close canvas">
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-jarvis-base/50 p-2">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-jarvis-base/70 backdrop-blur-sm">
            <Spinner className="h-6 w-6 text-jarvis-accent" />
            <span className="font-mono text-xs text-jarvis-muted">Loading in Canvas...</span>
          </div>
        )}

        <div
          className={cn(
            'flex h-full w-full items-center justify-center transition-all duration-300',
            deviceMode === 'mobile' &&
              'my-auto max-h-[740px] max-w-[375px] rounded-2xl border-4 border-jarvis-borderStrong bg-black shadow-2xl'
          )}
        >
          {activeUrl ? (
            <iframe
              key={refreshKey}
              src={activeUrl}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              title={canvasState.title || 'Workspace Canvas'}
              className="h-full w-full rounded border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Globe className="h-10 w-10 text-jarvis-muted/40" />
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-jarvis-ivory">
                  Workspace Canvas Ready
                </p>
                <p className="max-w-[280px] text-xs text-jarvis-muted">
                  Run a dev server, generate a PDF report, or type a local URL to render it inside Jarvis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-jarvis-border bg-jarvis-elevated/40 px-3 text-[10px] text-jarvis-muted">
        <span className="truncate font-mono">
          {canvasState.title || activeUrl || 'Idle'}
        </span>
        <span className="shrink-0 font-mono text-3xs uppercase tracking-wider text-jarvis-accent">
          {deviceMode} viewport
        </span>
      </div>
    </aside>
  )
}
