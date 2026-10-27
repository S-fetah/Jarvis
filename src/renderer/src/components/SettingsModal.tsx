import React, { useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Globe2,
  KeyRound,
  Monitor,
  Moon,
  Settings2,
  ShieldCheck,
  Sun
} from 'lucide-react'
import type { JarvisSettings, ThemePreference } from '../../../shared/types'
import { cn } from '../lib/cn'
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Field, Switch } from './ui'

interface SettingsModalProps {
  settings: JarvisSettings
  isOpen: boolean
  onClose: () => void
  onSave: (updated: Partial<JarvisSettings>) => Promise<void>
}

const themeOptions: Array<{ value: ThemePreference; label: string; icon: React.ElementType }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

function Section({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="grid gap-3 sm:grid-cols-[140px_1fr] sm:gap-5">
      <div>
        <h3 className="text-[12px] font-semibold text-jarvis-ivory">{title}</h3>
        <p className="mt-1 text-[10.5px] leading-relaxed text-jarvis-muted">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function SettingsModal({
  settings,
  isOpen,
  onClose,
  onSave
}: SettingsModalProps): React.JSX.Element | null {
  const [gatewayUrl, setGatewayUrl] = useState(settings.gatewayUrl || 'http://127.0.0.1:31415/v1')
  const [apiKey, setApiKey] = useState('')
  const [mascotEnabled, setMascotEnabled] = useState(settings.mascotEnabled !== false)
  const [reduceMotion, setReduceMotion] = useState(settings.reduceMotion === true)
  const [theme, setTheme] = useState<ThemePreference>(settings.theme || 'system')
  const [launchOnLogin, setLaunchOnLogin] = useState(settings.launchOnLogin === true)
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimizeToTray !== false)
  const [exportingDiag, setExportingDiag] = useState(false)
  const [diagExported, setDiagExported] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  const handleExportDiagnostics = async (): Promise<void> => {
    if (!window.jarvisAPI?.exportDiagnostics) return
    setExportingDiag(true)
    try {
      const res = await window.jarvisAPI.exportDiagnostics()
      if (res.success) {
        setDiagExported(true)
        window.setTimeout(() => setDiagExported(false), 2500)
        if (window.jarvisAPI?.openPath) {
          window.jarvisAPI.openPath(res.filePath)
        }
      }
    } finally {
      setExportingDiag(false)
    }
  }

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        gatewayUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        mascotEnabled,
        reduceMotion,
        theme,
        launchOnLogin,
        minimizeToTray
      })
      setSavedSuccess(true)
      window.setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 700)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="max-h-[88vh]">
        <div className="flex items-start gap-3 border-b border-jarvis-border px-5 py-4 pr-12">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-jarvis-accent/20 bg-jarvis-accentSoft text-jarvis-accent">
            <Settings2 className="h-[18px] w-[18px]" />
          </span>
          <div>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Gateway, appearance, workspace, and companion preferences. Changes are stored locally.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <Section
              title="Gateway"
              description="The local FreeLLMAPI endpoint Jarvis uses for model requests."
            >
              <Field
                label="Gateway URL"
                value={gatewayUrl}
                onChange={(event) => setGatewayUrl(event.target.value)}
                placeholder="http://127.0.0.1:31415/v1"
                icon={<Globe2 className="h-3.5 w-3.5" />}
                className="font-mono text-[11.5px]"
                hint="The standard FreeLLMAPI gateway listens on port 31415."
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-jarvis-muted">
                    FreeLLMAPI unified key
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-jarvis-accent hover:underline"
                  >
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showKey ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <Field
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    settings.hasApiKey
                      ? '•••••••• — encrypted key saved; enter a new key to replace'
                      : 'Leave blank to use the auto-detected local key'
                  }
                  icon={<KeyRound className="h-3.5 w-3.5" />}
                  className="font-mono text-[11.5px]"
                  aria-label="FreeLLMAPI unified key"
                />
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-2.5 py-2 text-[10.5px] leading-snug',
                    settings.hasApiKey
                      ? 'border-jarvis-accent/20 bg-jarvis-accentSoft/60 text-jarvis-accent'
                      : 'border-jarvis-border bg-jarvis-base text-jarvis-muted'
                  )}
                >
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {settings.hasApiKey
                      ? 'Encrypted at rest with Windows hardware-backed storage. The key is never exposed to the renderer.'
                      : 'Jarvis will auto-detect the FreeLLMAPI desktop key from the local database if this is blank.'}
                  </span>
                </div>
              </div>
            </Section>

            <div className="h-px bg-jarvis-border" />

            <Section
              title="Appearance"
              description="Choose a surface. System follows the Windows light or dark preference."
            >
              <div className="grid grid-cols-3 gap-1 rounded-md border border-jarvis-border bg-jarvis-base p-1">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const active = theme === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex h-9 items-center justify-center gap-1.5 rounded text-[11px] font-medium transition',
                        active
                          ? 'bg-jarvis-elevated text-jarvis-ivory shadow-hairline'
                          : 'text-jarvis-muted hover:text-jarvis-sage'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', active && 'text-jarvis-accent')} />
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10.5px] leading-relaxed text-jarvis-muted">
                The interface, native titlebar, and quick-chat shell update together.
              </p>
            </Section>

            <div className="h-px bg-jarvis-border" />

            <Section
              title="Workspace"
              description="The directory Jarvis reads and writes inside. Change it from the sidebar."
            >
              <div className="flex items-center gap-2 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-jarvis-accent" />
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-jarvis-sage">
                  {settings.workspacePaths[0] || 'Default workspace'}
                </span>
                <Badge variant="neutral">active</Badge>
              </div>
            </Section>

            <div className="h-px bg-jarvis-border" />

            <div className="h-px bg-jarvis-border" />

            <Section
              title="System and Tray"
              description="Windows integration, startup auto-launch, and diagnostic reporting."
            >
              <div className="flex items-center justify-between gap-4 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <div>
                  <p className="text-[11.5px] font-medium text-jarvis-ivory">Launch on startup</p>
                  <p className="mt-0.5 text-[10.5px] text-jarvis-muted">
                    Automatically start Jarvis when logging into Windows.
                  </p>
                </div>
                <Switch
                  checked={launchOnLogin}
                  onCheckedChange={setLaunchOnLogin}
                  label="Start Jarvis when Windows boots"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <div>
                  <p className="text-[11.5px] font-medium text-jarvis-ivory">Minimize to tray</p>
                  <p className="mt-0.5 text-[10.5px] text-jarvis-muted">
                    Keep Jarvis running in the background when the main window is closed.
                  </p>
                </div>
                <Switch
                  checked={minimizeToTray}
                  onCheckedChange={setMinimizeToTray}
                  label="Minimize to system tray on close"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <div>
                  <p className="text-[11.5px] font-medium text-jarvis-ivory">Support diagnostics</p>
                  <p className="mt-0.5 text-[10.5px] text-jarvis-muted">
                    Export a sanitized diagnostic bundle (JSON/Markdown) for troubleshooting.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportDiagnostics}
                  className="shrink-0 gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {exportingDiag ? 'Exporting...' : diagExported ? 'Exported!' : 'Export bundle'}
                </Button>
              </div>
            </Section>

            <Section
              title="Companion"
              description="The floating owl lives above your desktop and opens quick chat on click."
            >
              <div className="flex items-center justify-between gap-4 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <div>
                  <p className="text-[11.5px] font-medium text-jarvis-ivory">Floating 3D owl</p>
                  <p className="mt-0.5 text-[10.5px] text-jarvis-muted">
                    Show the companion window on the desktop.
                  </p>
                </div>
                <Switch
                  checked={mascotEnabled}
                  onCheckedChange={setMascotEnabled}
                  label="Enable floating 3D owl companion"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2.5">
                <div>
                  <p className="text-[11.5px] font-medium text-jarvis-ivory">Reduce motion</p>
                  <p className="mt-0.5 text-[10.5px] text-jarvis-muted">
                    Keep the owl calm with low-frequency animation.
                  </p>
                </div>
                <Switch
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                  label="Reduce mascot motion"
                />
              </div>
            </Section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-jarvis-border bg-jarvis-base px-5 py-3">
            <p className="hidden text-[10px] text-jarvis-muted sm:block">
              Local settings · no cloud sync
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={isSaving} className="min-w-[124px]">
                {savedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </>
                ) : isSaving ? (
                  'Saving…'
                ) : (
                  'Save settings'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
