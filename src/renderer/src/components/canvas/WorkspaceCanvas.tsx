import React, { useEffect, useState, useRef } from 'react'
import {
  ExternalLink,
  Globe,
  FileText,
  FolderOpen,
  Download,
  Laptop,
  RotateCw,
  Smartphone,
  X,
  Code2,
  AlertCircle
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

/**
 * Converts a base64 Data URL (data:application/pdf;base64,...) to a local Blob URL
 * so Chromium's native PDF plugin can stream and render it without data URL limits.
 */
function base64ToBlobUrl(dataUrl: string): string {
  try {
    const parts = dataUrl.split(',')
    if (parts.length < 2) return ''
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf'
    const binaryStr = atob(parts[1])
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })
    return URL.createObjectURL(blob)
  } catch (err) {
    console.error('[WorkspaceCanvas] Failed to convert base64 to blob URL:', err)
    return ''
  }
}

export function WorkspaceCanvas({
  canvasState,
  onClose,
  onUpdateState,
  onOpenExternal
}: WorkspaceCanvasProps): React.JSX.Element | null {
  const [addressInput, setAddressInput] = useState(canvasState.url)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const [refreshKey, setRefreshKey] = useState(0)

  const activeBlobUrlRef = useRef<string | null>(null)

  const isPdf =
    canvasState.type === 'pdf' ||
    canvasState.url.toLowerCase().endsWith('.pdf') ||
    Boolean(canvasState.dataUrl?.startsWith('data:application/pdf'))

  // Synchronize address input on URL changes
  useEffect(() => {
    setAddressInput(canvasState.url)
  }, [canvasState.url])

  // PDF Data & Blob URL Lifecycle
  useEffect(() => {
    let cancelled = false

    const loadPdfAsset = async (): Promise<void> => {
      if (!isPdf) {
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current)
          activeBlobUrlRef.current = null
          setPdfBlobUrl(null)
        }
        return
      }

      // If dataUrl is already provided, convert directly to Blob URL
      if (canvasState.dataUrl) {
        const blobUrl = base64ToBlobUrl(canvasState.dataUrl)
        if (blobUrl) {
          if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current)
          }
          activeBlobUrlRef.current = blobUrl
          setPdfBlobUrl(blobUrl)
          setLoadError(null)
          setIsLoading(false)
          return
        }
      }

      // If dataUrl not present, fetch file data via IPC bridge
      if (window.jarvisAPI?.readFileData) {
        setIsLoading(true)
        setLoadError(null)
        try {
          const targetPath = canvasState.filePath || canvasState.url
          const res = await window.jarvisAPI.readFileData(targetPath)
          if (cancelled) return

          if (res.success && res.dataUrl) {
            const blobUrl = base64ToBlobUrl(res.dataUrl)
            if (activeBlobUrlRef.current) {
              URL.revokeObjectURL(activeBlobUrlRef.current)
            }
            activeBlobUrlRef.current = blobUrl
            setPdfBlobUrl(blobUrl)
            setIsLoading(false)
            onUpdateState({
              dataUrl: res.dataUrl,
              filePath: res.filePath || targetPath,
              title: res.fileName || canvasState.title
            })
          } else {
            setLoadError(res.error || `Could not find PDF file: ${targetPath}`)
            setIsLoading(false)
          }
        } catch (err: any) {
          if (!cancelled) {
            setLoadError(err.message || 'Failed to read PDF document')
            setIsLoading(false)
          }
        }
      }
    }

    void loadPdfAsset()

    return () => {
      cancelled = true
    }
  }, [canvasState.dataUrl, canvasState.url, canvasState.filePath, isPdf, refreshKey])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current)
        activeBlobUrlRef.current = null
      }
    }
  }, [])

  if (!canvasState.open) return null

  const handleNavigate = (e: React.FormEvent): void => {
    e.preventDefault()
    let target = addressInput.trim()
    if (!target) return

    // If navigated to a PDF file path
    if (target.toLowerCase().endsWith('.pdf')) {
      onUpdateState({
        url: target,
        type: 'pdf',
        title: target.split(/[\\/]/).pop() || target,
        dataUrl: undefined,
        filePath: target
      })
      setRefreshKey((k) => k + 1)
      return
    }

    // If navigated to an HTML file path
    if (target.toLowerCase().endsWith('.html') || target.toLowerCase().endsWith('.htm')) {
      onUpdateState({
        url: target,
        type: 'preview',
        title: target.split(/[\\/]/).pop() || target,
        dataUrl: undefined,
        filePath: target
      })
      setRefreshKey((k) => k + 1)
      return
    }

    // Standard web URL formatting
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
    onUpdateState({ url: target, type: 'browser', title: target, dataUrl: undefined, filePath: undefined })
    setRefreshKey((k) => k + 1)
  }

  const handleReload = (): void => {
    setIsLoading(true)
    setLoadError(null)
    setRefreshKey((k) => k + 1)
  }

  const handleOpenInSystemViewer = async (): Promise<void> => {
    const target = canvasState.filePath || canvasState.url
    if (window.jarvisAPI?.openPath) {
      await window.jarvisAPI.openPath(target, true)
    }
  }

  const handleShowInFolder = async (): Promise<void> => {
    const target = canvasState.filePath || canvasState.url
    if (window.jarvisAPI?.showItemInFolder) {
      await window.jarvisAPI.showItemInFolder(target)
    } else if (window.jarvisAPI?.openPath) {
      await window.jarvisAPI.openPath(target, false)
    }
  }

  const handleDownloadCopy = (): void => {
    const downloadHref = pdfBlobUrl || canvasState.dataUrl
    if (!downloadHref) return
    const a = document.createElement('a')
    a.href = downloadHref
    a.download = canvasState.title.endsWith('.pdf') ? canvasState.title : `${canvasState.title}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Determine whether activeUrl is a safe external or data URL (guards against SPA recursion)
  const activeUrl = canvasState.dataUrl || canvasState.url
  const isWebUrl =
    activeUrl.startsWith('http://') ||
    activeUrl.startsWith('https://') ||
    activeUrl.startsWith('data:') ||
    activeUrl.startsWith('blob:')

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
            {isPdf ? 'PDF' : 'Canvas'}
          </span>
        </div>

        {/* Address / URL Bar */}
        <form onSubmit={handleNavigate} className="flex min-w-0 flex-1 items-center">
          <div className="relative flex w-full items-center">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder={isPdf ? 'PDF Document path...' : 'Enter URL (e.g. http://localhost:5173)...'}
              className="h-7 w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 font-mono text-[11px] text-jarvis-ivory placeholder-jarvis-muted/60 transition focus:border-jarvis-accent/60 focus:outline-none focus:ring-1 focus:ring-jarvis-accent/30"
            />
          </div>
        </form>

        {/* Top Bar Action Buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label="Reload document or canvas">
            <IconButton label="Reload" size="sm" onClick={handleReload}>
              <RotateCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin text-jarvis-accent')} />
            </IconButton>
          </Tooltip>

          {isPdf ? (
            <>
              <Tooltip label="Open in default System PDF Viewer (e.g. Acrobat / Edge)">
                <IconButton label="Open System Viewer" size="sm" onClick={() => void handleOpenInSystemViewer()}>
                  <ExternalLink className="h-3.5 w-3.5 text-jarvis-accent" />
                </IconButton>
              </Tooltip>

              <Tooltip label="Show file in Windows Explorer folder">
                <IconButton label="Show in Folder" size="sm" onClick={() => void handleShowInFolder()}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </IconButton>
              </Tooltip>

              <Tooltip label="Save / Download copy">
                <IconButton label="Download PDF" size="sm" onClick={handleDownloadCopy}>
                  <Download className="h-3.5 w-3.5" />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
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
            </>
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
            <span className="font-mono text-xs text-jarvis-muted">
              {isPdf ? 'Loading PDF Document...' : 'Loading in Canvas...'}
            </span>
          </div>
        )}

        <div
          className={cn(
            'flex h-full w-full items-center justify-center transition-all duration-300',
            !isPdf &&
              deviceMode === 'mobile' &&
              'my-auto max-h-[740px] max-w-[375px] rounded-2xl border-4 border-jarvis-borderStrong bg-black shadow-2xl'
          )}
        >
          {loadError ? (
            <div className="flex max-w-md flex-col items-center justify-center gap-3 rounded-xl border border-jarvis-border bg-jarvis-elevated/80 p-6 text-center shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display text-sm font-semibold text-jarvis-ivory">
                  Unable to Preview Document
                </h4>
                <p className="font-mono text-xs text-jarvis-muted">{loadError}</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReload}
                  className="rounded-md bg-jarvis-accent px-3 py-1.5 text-xs font-semibold text-jarvis-accentContrast shadow transition hover:opacity-90"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => void handleShowInFolder()}
                  className="rounded-md border border-jarvis-border bg-jarvis-surface px-3 py-1.5 text-xs font-medium text-jarvis-ivory hover:bg-jarvis-elevated"
                >
                  Locate in Explorer
                </button>
              </div>
            </div>
          ) : isPdf ? (
            pdfBlobUrl ? (
              <object
                key={`${refreshKey}-${pdfBlobUrl}`}
                data={pdfBlobUrl}
                type="application/pdf"
                className="h-full w-full rounded border-0 bg-white shadow-sm"
                title={canvasState.title || 'PDF Document'}
              >
                {/* Fallback in case Chromium embedded PDF handler is disabled */}
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-jarvis-base/95 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-jarvis-accent/30 bg-jarvis-accent/10">
                    <FileText className="h-8 w-8 text-jarvis-accent" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-base font-semibold text-jarvis-ivory">
                      {canvasState.title || 'PDF Document Ready'}
                    </h3>
                    <p className="max-w-md font-mono text-xs text-jarvis-muted">
                      {canvasState.filePath || canvasState.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleOpenInSystemViewer()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-jarvis-accent px-4 py-2 text-xs font-semibold text-jarvis-accentContrast shadow hover:opacity-90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in System PDF Viewer
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShowInFolder()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-jarvis-border bg-jarvis-surface px-4 py-2 text-xs font-medium text-jarvis-ivory hover:bg-jarvis-elevated"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-jarvis-muted" />
                      Show in Folder
                    </button>
                  </div>
                </div>
              </object>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-10 w-10 text-jarvis-accent/60" />
                <span className="font-mono text-xs text-jarvis-muted">Reading document bytes...</span>
              </div>
            )
          ) : isWebUrl ? (
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
          {canvasState.title || canvasState.filePath || activeUrl || 'Idle'}
        </span>
        <span className="shrink-0 font-mono text-3xs uppercase tracking-wider text-jarvis-accent">
          {isPdf ? 'Native PDF Viewer' : `${deviceMode} viewport`}
        </span>
      </div>
    </aside>
  )
}
