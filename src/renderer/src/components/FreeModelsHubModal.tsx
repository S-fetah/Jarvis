import React, { useEffect, useState } from 'react'
import {
  ExternalLink,
  RotateCcw,
  Check,
  Server,
  Cpu,
  AlertCircle
} from 'lucide-react'
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Switch } from './ui'
import type { ProviderHubState, ProviderId } from '../../../shared/types'

interface FreeModelsHubModalProps {
  isOpen: boolean
  onClose: () => void
  onRefreshCatalog: () => Promise<void>
}

export function FreeModelsHubModal({
  isOpen,
  onClose,
  onRefreshCatalog
}: FreeModelsHubModalProps): React.JSX.Element {
  const [hubState, setHubState] = useState<ProviderHubState | null>(null)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latencyMs?: number; error?: string }>
  >({})
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null)
  const [serverPortInput, setServerPortInput] = useState('31415')
  const [serverToggling, setServerToggling] = useState(false)

  // Fetch Hub State on open
  useEffect(() => {
    if (!isOpen || !window.jarvisAPI?.getProviderHubState) return
    window.jarvisAPI
      .getProviderHubState()
      .then((state) => {
        setHubState(state)
        setServerPortInput(String(state.localServerPort || 31415))
        const bInputs: Record<string, string> = {}
        for (const p of state.providers) {
          if (p.baseUrl) bInputs[p.id] = p.baseUrl
        }
        setBaseUrlInputs(bInputs)
      })
      .catch((err) => console.error('Failed to load hub state:', err))
  }, [isOpen])

  const handleOpenLink = (url: string): void => {
    if (url && window.jarvisAPI?.openExternalUrl) {
      window.jarvisAPI.openExternalUrl(url)
    }
  }

  const handleSaveKey = async (providerId: ProviderId): Promise<void> => {
    const rawKey = keyInputs[providerId] || ''
    const baseUrl = baseUrlInputs[providerId]
    if (!window.jarvisAPI?.updateProviderKey) return

    await window.jarvisAPI.updateProviderKey(providerId, rawKey, baseUrl)
    setSavedSuccessId(providerId)
    setTimeout(() => setSavedSuccessId(null), 2500)

    setKeyInputs((prev) => ({ ...prev, [providerId]: '' }))

    if (window.jarvisAPI.getProviderHubState) {
      const updated = await window.jarvisAPI.getProviderHubState()
      setHubState(updated)
    }
    void onRefreshCatalog()
  }

  const handleToggleEnabled = async (providerId: ProviderId, enabled: boolean): Promise<void> => {
    if (!window.jarvisAPI?.setProviderEnabled) return
    await window.jarvisAPI.setProviderEnabled(providerId, enabled)
    if (window.jarvisAPI.getProviderHubState) {
      const updated = await window.jarvisAPI.getProviderHubState()
      setHubState(updated)
    }
    void onRefreshCatalog()
  }

  const handleTestConnection = async (providerId: ProviderId): Promise<void> => {
    if (!window.jarvisAPI?.testProviderConnection) return
    setTestingId(providerId)
    setTestResults((prev) => ({ ...prev, [providerId]: undefined as any }))
    try {
      const res = await window.jarvisAPI.testProviderConnection(providerId)
      setTestResults((prev) => ({ ...prev, [providerId]: res }))
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [providerId]: { success: false, error: err.message } }))
    } finally {
      setTestingId(null)
    }
  }

  const handleToggleLocalServer = async (enabled: boolean): Promise<void> => {
    if (!window.jarvisAPI?.toggleLocalGatewayServer) return
    setServerToggling(true)
    const port = parseInt(serverPortInput, 10) || 31415
    try {
      await window.jarvisAPI.toggleLocalGatewayServer(enabled, port)
      if (window.jarvisAPI.getProviderHubState) {
        const updated = await window.jarvisAPI.getProviderHubState()
        setHubState(updated)
      }
    } finally {
      setServerToggling(false)
    }
  }

  const providers = hubState?.providers || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby="providers-hub-description"
        className="max-h-[88vh] w-[92vw] max-w-4xl overflow-hidden p-0"
      >
        {/* Header */}
        <div className="border-b border-jarvis-border bg-jarvis-surface px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-jarvis-accent/15 text-jarvis-accent">
                  <Cpu className="h-3.5 w-3.5" />
                </span>
                <DialogTitle className="font-display text-base font-semibold text-jarvis-ivory">
                  Native Providers & Models Hub
                </DialogTitle>
                <Badge variant="accent" mono className="text-[10px]">
                  Internal Gateway
                </Badge>
              </div>
              <DialogDescription id="providers-hub-description" className="mt-1 text-xs text-jarvis-muted">
                Configure your direct AI provider tokens. Jarvis balances requests across models, seamlessly
                fails over during rate limits, and secures keys with Windows DPAPI encryption.
              </DialogDescription>
            </div>
          </div>

          {/* Local Gateway Server Banner */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-jarvis-border bg-jarvis-elevated/70 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jarvis-base text-jarvis-accent">
                <Server className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-jarvis-ivory">Local OpenAI API Gateway</span>
                  {hubState?.localServerRunning ? (
                    <Badge variant="accent" mono className="gap-1 text-3xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live on port {hubState.localServerPort}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" mono className="text-3xs">
                      Offline
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-[10px] text-jarvis-muted">
                  Exposes standard OpenAI `/v1/chat/completions` on localhost for VS Code (Cursor / Continue), terminal, and Open WebUI.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-jarvis-muted">Port:</span>
                <input
                  type="text"
                  value={serverPortInput}
                  disabled={hubState?.localServerRunning}
                  onChange={(e) => setServerPortInput(e.target.value)}
                  className="h-6 w-16 rounded border border-jarvis-border bg-jarvis-base px-1.5 text-center font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                />
              </div>
              <Switch
                label="Toggle local gateway server"
                checked={Boolean(hubState?.localServerRunning || hubState?.localServerEnabled)}
                disabled={serverToggling}
                onCheckedChange={(checked) => void handleToggleLocalServer(checked)}
              />
            </div>
          </div>
        </div>

        {/* Providers Scroll Area */}
        <div className="max-h-[56vh] overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => {
              const testRes = testResults[provider.id]
              const isTesting = testingId === provider.id
              const isSaved = savedSuccessId === provider.id
              const hasDraftKey = Boolean((keyInputs[provider.id] || '').trim())

              return (
                <article
                  key={provider.id}
                  className="flex flex-col justify-between rounded-xl border border-jarvis-border bg-jarvis-elevated/90 p-4 transition hover:border-jarvis-borderStrong"
                >
                  <div>
                    {/* Top line: Name, Status badge, Enable switch */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-semibold text-jarvis-ivory">{provider.name}</h3>
                          {provider.isLocal && (
                            <Badge variant="neutral" mono className="text-3xs">
                              Offline / Local
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-jarvis-muted line-clamp-2">
                          {provider.description}
                        </p>
                      </div>
                      <Switch
                        label={`Toggle ${provider.name}`}
                        checked={provider.enabled}
                        onCheckedChange={(checked) => void handleToggleEnabled(provider.id, checked)}
                      />
                    </div>

                    {/* Key Input & Actions */}
                    {!provider.isLocal && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <input
                              type="password"
                              value={keyInputs[provider.id] || ''}
                              onChange={(e) =>
                                setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                              }
                              placeholder={
                                provider.hasKey
                                  ? `Configured (${provider.previewKey || '••••••••'})`
                                  : 'Paste API Key...'
                              }
                              className="h-7 w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 font-mono text-[11px] text-jarvis-ivory placeholder-jarvis-muted/70 transition focus:border-jarvis-accent focus:outline-none"
                            />
                          </div>

                          <Button
                            variant={isSaved ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={!hasDraftKey}
                            onClick={() => void handleSaveKey(provider.id)}
                            className="h-7 px-2.5 text-[10.5px]"
                          >
                            {isSaved ? (
                              <>
                                <Check className="h-3 w-3" /> Saved
                              </>
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Supported Models Badges */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {provider.models.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="rounded border border-jarvis-border bg-jarvis-base/80 px-1.5 py-0.5 font-mono text-3xs text-jarvis-sage"
                        >
                          {m}
                        </span>
                      ))}
                      {provider.models.length > 3 && (
                        <span className="font-mono text-3xs text-jarvis-muted self-center">
                          +{provider.models.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Test result status strip */}
                    {testRes && (
                      <div
                        className={`mt-2.5 flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] ${
                          testRes.success
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {testRes.success ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Connected ({testRes.latencyMs}ms)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            <span className="truncate">{testRes.error || 'Connection failed'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-jarvis-border/60 pt-2.5">
                    {provider.getKeyUrl ? (
                      <button
                        type="button"
                        onClick={() => handleOpenLink(provider.getKeyUrl)}
                        className="inline-flex items-center gap-1 text-[10.5px] font-medium text-jarvis-accent hover:underline"
                      >
                        <span>Get API Key</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-jarvis-muted">Custom Endpoint</span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isTesting}
                      onClick={() => void handleTestConnection(provider.id)}
                      className="h-6 gap-1 px-2 text-[10px] text-jarvis-muted hover:text-jarvis-ivory"
                    >
                      <RotateCcw className={`h-2.5 w-2.5 ${isTesting ? 'animate-spin text-jarvis-accent' : ''}`} />
                      {isTesting ? 'Testing…' : 'Ping Test'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-jarvis-border bg-jarvis-base px-6 py-3">
          <span className="font-mono text-3xs text-jarvis-muted">
            Keys are encrypted using Windows DPAPI safeStorage. Plaintext keys are never sent to renderer.
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
