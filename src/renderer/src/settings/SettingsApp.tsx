import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  Brain,
  Check,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Monitor,
  Moon,
  RotateCcw,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Zap
} from 'lucide-react'
import type {
  JarvisSettings,
  ModelCatalog,
  ProviderHubState,
  ProviderId,
  TalkingStyle,
  ThemePreference,
  ThinkingDepth
} from '../../../shared/types'
import { JarvisMark } from '../components/brand/JarvisMark'
import { Badge, Button, Switch } from '../components/ui'
import { applyTheme, readCachedTheme } from '../lib/theme'
import { cn } from '../lib/cn'
import { scanPromptSafety } from '../../../shared/prompt-safety'

type SettingsTab = 'providers' | 'models' | 'prompts' | 'app'

export function SettingsApp(): React.JSX.Element {
  // Navigation
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')

  // Core Data
  const [settings, setSettings] = useState<JarvisSettings | null>(null)
  const [hubState, setHubState] = useState<ProviderHubState | null>(null)
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [userMemoryMarkdown, setUserMemoryMarkdown] = useState<string>('')
  const [userMemoryPath, setUserMemoryPath] = useState<string>('')

  // Interactive Form State
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({})
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latencyMs?: number; error?: string }>
  >({})
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null)
  const [serverPortInput, setServerPortInput] = useState('31415')
  const [serverToggling, setServerToggling] = useState(false)
  const [memorySaving, setMemorySaving] = useState(false)
  const [memorySaved, setMemorySaved] = useState(false)
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false)
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null)
  const [importingFreeApi, setImportingFreeApi] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [customPromptText, setCustomPromptText] = useState<string>('')
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false)
  const [customPromptSaving, setCustomPromptSaving] = useState(false)
  const [customPromptSaved, setCustomPromptSaved] = useState(false)

  // Initialize theme and load all state on mount
  useEffect(() => {
    const cached = readCachedTheme()
    applyTheme(cached)

    // Parse initial tab from URL hash if provided (#settings?tab=prompts)
    try {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.split('?')[1] || '')
      const tabParam = params.get('tab') as SettingsTab | null
      if (tabParam && ['providers', 'models', 'prompts', 'app'].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    } catch {
      // Ignore
    }

    // Listen to tab navigation events from main process
    const unsubTab = window.jarvisAPI?.onNavigateSettingsTab?.((tab) => {
      if (['providers', 'models', 'prompts', 'app'].includes(tab)) {
        setActiveTab(tab as SettingsTab)
      }
    })

    // Load initial settings
    if (window.jarvisAPI?.getSettings) {
      window.jarvisAPI.getSettings().then((s) => {
        setSettings(s)
        if (s.theme) applyTheme(s.theme)
        if (s.customPrompt !== undefined) setCustomPromptText(s.customPrompt)
        if (s.customPromptRiskAcknowledged !== undefined) setRiskAcknowledged(s.customPromptRiskAcknowledged)
      })
    }

    // Load provider hub state
    refreshHubState()

    // Load model catalog
    if (window.jarvisAPI?.getAvailableModels) {
      window.jarvisAPI.getAvailableModels().then(setCatalog)
    }

    // Load USER.md persistent memory
    refreshUserMemory()

    return () => {
      unsubTab?.()
    }
  }, [])

  const refreshHubState = async (): Promise<void> => {
    if (!window.jarvisAPI?.getProviderHubState) return
    try {
      const state = await window.jarvisAPI.getProviderHubState()
      setHubState(state)
      setServerPortInput(String(state.localServerPort || 31415))
      const bInputs: Record<string, string> = {}
      for (const p of state.providers) {
        if (p.baseUrl) bInputs[p.id] = p.baseUrl
      }
      setBaseUrlInputs(bInputs)
    } catch (err) {
      console.error('[SettingsApp] Failed to load provider hub state:', err)
    }
  }

  const refreshUserMemory = async (): Promise<void> => {
    if (!window.jarvisAPI?.getUserMemory) return
    try {
      const res = await window.jarvisAPI.getUserMemory()
      setUserMemoryMarkdown(res.rawMarkdown || '')
      setUserMemoryPath(res.filePath || '')
    } catch (err) {
      console.error('[SettingsApp] Failed to load user memory:', err)
    }
  }

  const handleUpdateSetting = async (partial: Partial<JarvisSettings>): Promise<void> => {
    if (!window.jarvisAPI?.updateSettings) return
    try {
      const updated = await window.jarvisAPI.updateSettings(partial)
      setSettings(updated)
      if (partial.theme) {
        applyTheme(partial.theme)
      }
    } catch (err) {
      console.error('[SettingsApp] Failed to update settings:', err)
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
    await refreshHubState()
    if (window.jarvisAPI.getAvailableModels) {
      const updatedCat = await window.jarvisAPI.getAvailableModels()
      setCatalog(updatedCat)
    }
  }

  const handleToggleEnabled = async (providerId: ProviderId, enabled: boolean): Promise<void> => {
    if (!window.jarvisAPI?.setProviderEnabled) return
    await window.jarvisAPI.setProviderEnabled(providerId, enabled)
    await refreshHubState()
    if (window.jarvisAPI.getAvailableModels) {
      const updatedCat = await window.jarvisAPI.getAvailableModels()
      setCatalog(updatedCat)
    }
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
      await refreshHubState()
    } finally {
      setServerToggling(false)
    }
  }

  const promptSafety = scanPromptSafety(customPromptText)

  const handleSaveCustomPrompt = async (): Promise<void> => {
    if (!promptSafety.isSafe && !riskAcknowledged) return
    setCustomPromptSaving(true)
    try {
      await handleUpdateSetting({
        customPrompt: customPromptText,
        customPromptRiskAcknowledged: riskAcknowledged
      })
      setCustomPromptSaved(true)
      setTimeout(() => setCustomPromptSaved(false), 2000)
    } finally {
      setCustomPromptSaving(false)
    }
  }

  const handleSaveUserMemory = async (): Promise<void> => {
    if (!window.jarvisAPI?.saveUserMemory) return
    setMemorySaving(true)
    try {
      await window.jarvisAPI.saveUserMemory(userMemoryMarkdown)
      setMemorySaved(true)
      setTimeout(() => setMemorySaved(false), 2000)
    } catch (err) {
      console.error('[SettingsApp] Failed to save user memory:', err)
    } finally {
      setMemorySaving(false)
    }
  }

  const handleExportDiagnostics = async (): Promise<void> => {
    if (!window.jarvisAPI?.exportDiagnostics) return
    setDiagnosticsRunning(true)
    setDiagnosticsMessage(null)
    try {
      const res = await window.jarvisAPI.exportDiagnostics()
      if (res.success) {
        setDiagnosticsMessage(`Saved to ${res.filePath}`)
        setTimeout(() => setDiagnosticsMessage(null), 5000)
      }
    } catch (err: any) {
      setDiagnosticsMessage(`Export failed: ${err.message}`)
    } finally {
      setDiagnosticsRunning(false)
    }
  }

  const handleImportFreeLLMAPI = async (): Promise<void> => {
    if (!window.jarvisAPI?.importFromFreeLLMAPI) return
    setImportingFreeApi(true)
    setImportMessage(null)
    try {
      const res = await window.jarvisAPI.importFromFreeLLMAPI()
      if (res.success) {
        setImportMessage(`Imported ${res.imported.join(', ')}!`)
        await refreshHubState()
        if (window.jarvisAPI.getAvailableModels) {
          const updatedCat = await window.jarvisAPI.getAvailableModels()
          setCatalog(updatedCat)
        }
      } else {
        setImportMessage(res.error || 'Import failed.')
      }
    } catch (err: any) {
      setImportMessage(err.message)
    } finally {
      setImportingFreeApi(false)
    }
  }

  const handleOpenExternal = (url: string): void => {
    if (url && window.jarvisAPI?.openExternalUrl) {
      window.jarvisAPI.openExternalUrl(url)
    }
  }

  const handleShowInFolder = (path: string): void => {
    if (path && window.jarvisAPI?.showItemInFolder) {
      window.jarvisAPI.showItemInFolder(path)
    }
  }

  const providers = hubState?.providers || []

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-jarvis-base font-sans text-jarvis-sage selection:bg-jarvis-accent/30 selection:text-jarvis-ivory">
      {/* Native Windows TitleBar Overlay Chrome */}
      <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-jarvis-border bg-jarvis-surface px-4">
        <div className="flex items-center gap-2.5">
          <JarvisMark className="h-4 w-4 text-jarvis-accent" />
          <span className="font-display text-xs font-semibold text-jarvis-ivory">
            Jarvis Configuration & Settings
          </span>
          <Badge variant="accent" mono className="text-3xs">
            Standalone Config
          </Badge>
        </div>

        {/* Windows overlay spacer (right-side buttons) */}
        <div className="no-drag w-32" />
      </header>

      {/* Main Multi-Pane Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left Navigation Sidebar */}
        <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-jarvis-border bg-jarvis-surface/60 p-3">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('providers')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                activeTab === 'providers'
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-ivory'
              )}
            >
              <Cpu className="h-4 w-4 shrink-0" />
              <span>AI Providers & Keys</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                activeTab === 'models'
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-ivory'
              )}
            >
              <Sliders className="h-4 w-4 shrink-0" />
              <span>Models & Balancer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prompts')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                activeTab === 'prompts'
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-ivory'
              )}
            >
              <Brain className="h-4 w-4 shrink-0" />
              <span>Prompts & USER.md</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('app')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                activeTab === 'app'
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-ivory'
              )}
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              <span>App & Windows</span>
            </button>
          </div>

          {/* Sidebar Footer Info */}
          <div className="rounded-lg border border-jarvis-border/60 bg-jarvis-base/60 p-2.5 font-mono text-[10px] text-jarvis-muted">
            <div className="flex items-center gap-1.5 text-jarvis-ivory">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              <span className="font-semibold">Local-First Vault</span>
            </div>
            <p className="mt-1 leading-snug text-3xs">
              Hardware DPAPI encryption. Keys never touch cloud services.
            </p>
          </div>
        </nav>

        {/* Right Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: AI PROVIDERS & KEYS */}
          {activeTab === 'providers' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="font-display text-xl font-semibold text-jarvis-ivory">
                  Native Providers & Credentials Hub
                </h1>
                <p className="mt-1 text-xs text-jarvis-muted leading-relaxed">
                  Connect your AI providers directly. Jarvis securely balances tokens, cascades
                  automatically on 429 rate limits, and stores credentials using Windows DPAPI safeStorage.
                </p>
              </div>

              {/* FreeLLMAPI Auto-Detected Migration Banner */}
              {hubState?.hasFreeLLMAPI && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-jarvis-accent/30 bg-jarvis-accent/5 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-jarvis-accent/20 text-jarvis-accent">
                      <Zap className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-jarvis-ivory">
                          FreeLLMAPI Database Detected
                        </span>
                        <Badge variant="accent" mono className="text-3xs">
                          Auto-Migration Ready
                        </Badge>
                      </div>
                      <p className="font-mono text-[10.5px] text-jarvis-muted mt-0.5">
                        Found local FreeLLMAPI credentials on this computer. You can decrypt and import your provider keys into Jarvis's DPAPI-encrypted vault with 1 click.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {importMessage && (
                      <span className="text-xs font-mono text-jarvis-accent">
                        {importMessage}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={importingFreeApi}
                      onClick={() => void handleImportFreeLLMAPI()}
                    >
                      {importingFreeApi ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          <span>Import FreeLLMAPI Keys</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Local Gateway Server Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-jarvis-border bg-jarvis-surface p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-jarvis-base text-jarvis-accent">
                    <Server className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-jarvis-ivory">
                        Local OpenAI API Gateway Server
                      </span>
                      {hubState?.localServerRunning ? (
                        <Badge variant="accent" mono className="gap-1 text-3xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Running on :{hubState.localServerPort}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" mono className="text-3xs">
                          Offline
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-[10.5px] text-jarvis-muted mt-0.5">
                      Exposes standard OpenAI `/v1/chat/completions` on localhost for VS Code (Cursor / Continue), terminal tools, and Open WebUI.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-jarvis-muted">Port:</span>
                    <input
                      type="text"
                      value={serverPortInput}
                      disabled={hubState?.localServerRunning}
                      onChange={(e) => setServerPortInput(e.target.value)}
                      className="h-7 w-16 rounded border border-jarvis-border bg-jarvis-base px-2 text-center font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
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

              {hubState?.localServerToken && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2">
                  <span className="text-xs font-semibold text-jarvis-ivory">API key for IDE clients:</span>
                  <code className="font-mono text-[10.5px] text-jarvis-muted break-all">{hubState.localServerToken}</code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(hubState.localServerToken || '')}
                    className="rounded border border-jarvis-border px-2 py-0.5 font-mono text-[10.5px] text-jarvis-ivory hover:border-jarvis-accent"
                  >
                    Copy
                  </button>
                  <span className="w-full font-mono text-[10.5px] text-jarvis-muted">
                    Required as `Authorization: Bearer &lt;key&gt;` (the "API key" field in Cursor / Continue). Requests from web pages are always refused.
                  </span>
                </div>
              )}

              {/* Providers Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {providers.map((provider) => {
                  const testRes = testResults[provider.id]
                  const isTesting = testingId === provider.id
                  const isSaved = savedSuccessId === provider.id
                  const hasDraftKey = Boolean((keyInputs[provider.id] || '').trim())
                  const isKeyVisible = Boolean(showKeyMap[provider.id])

                  return (
                    <article
                      key={provider.id}
                      className="flex flex-col justify-between rounded-xl border border-jarvis-border bg-jarvis-surface p-4 shadow-sm transition hover:border-jarvis-borderStrong"
                    >
                      <div>
                        {/* Top: Name, Status badge, Switch */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display text-sm font-semibold text-jarvis-ivory">
                                {provider.name}
                              </span>
                              {provider.hasKey ? (
                                <Badge variant="accent" dot className="text-3xs">
                                  Configured
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="text-3xs">
                                  No Key
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-jarvis-muted leading-relaxed">
                              {provider.description}
                            </p>
                          </div>

                          <Switch
                            label={`Enable ${provider.name}`}
                            checked={provider.enabled}
                            onCheckedChange={(checked) =>
                              void handleToggleEnabled(provider.id, checked)
                            }
                          />
                        </div>

                        {/* API Key Input */}
                        <div className="mt-3.5 space-y-2">
                          {provider.id === 'pollinations' || provider.id === 'ovh' ? (
                            <div className="flex h-8 items-center rounded-md border border-jarvis-border/60 bg-jarvis-base/50 px-3 font-mono text-[11px] text-emerald-400">
                              <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                              <span>Keyless Free Community Tier (No Key Required)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <input
                                  type={isKeyVisible ? 'text' : 'password'}
                                  value={
                                    keyInputs[provider.id] !== undefined
                                      ? keyInputs[provider.id]
                                      : provider.hasKey
                                        ? provider.previewKey || '••••••••••••••••'
                                        : ''
                                  }
                                  onChange={(e) =>
                                    setKeyInputs((prev) => ({
                                      ...prev,
                                      [provider.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Paste API Key…"
                                  className="h-8 w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 pr-8 font-mono text-xs text-jarvis-ivory placeholder:text-jarvis-muted/60 focus:border-jarvis-accent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowKeyMap((prev) => ({
                                      ...prev,
                                      [provider.id]: !prev[provider.id]
                                    }))
                                  }
                                  className="absolute right-2 top-2 text-jarvis-muted hover:text-jarvis-ivory"
                                >
                                  {isKeyVisible ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>

                              <Button
                                variant={isSaved ? 'primary' : 'secondary'}
                                size="sm"
                                disabled={!hasDraftKey}
                                onClick={() => void handleSaveKey(provider.id)}
                                className="h-8 px-3 text-xs"
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Saved
                                  </>
                                ) : (
                                  'Save'
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Base URL (if custom endpoint) */}
                          {provider.id === 'ollama' && (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-3xs text-jarvis-muted">URL:</span>
                              <input
                                type="text"
                                value={baseUrlInputs[provider.id] || 'http://127.0.0.1:11434'}
                                onChange={(e) =>
                                  setBaseUrlInputs((prev) => ({
                                    ...prev,
                                    [provider.id]: e.target.value
                                  }))
                                }
                                className="h-7 flex-1 rounded border border-jarvis-border bg-jarvis-base px-2 font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {/* Supported Models Badges */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {provider.models.slice(0, 4).map((m) => (
                            <span
                              key={m}
                              className="rounded border border-jarvis-border bg-jarvis-base/80 px-1.5 py-0.5 font-mono text-3xs text-jarvis-sage"
                            >
                              {m}
                            </span>
                          ))}
                          {provider.models.length > 4 && (
                            <span className="self-center font-mono text-3xs text-jarvis-muted">
                              +{provider.models.length - 4} more
                            </span>
                          )}
                        </div>

                        {/* Ping Test Result Strip */}
                        {testRes && (
                          <div
                            className={`mt-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10.5px] ${
                              testRes.success
                                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {testRes.success ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Connected ({testRes.latencyMs}ms)</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span className="truncate">{testRes.error || 'Connection failed'}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Links & Ping Trigger */}
                      <div className="mt-4 flex items-center justify-between border-t border-jarvis-border/60 pt-3">
                        {provider.getKeyUrl ? (
                          <button
                            type="button"
                            onClick={() => handleOpenExternal(provider.getKeyUrl!)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-jarvis-accent hover:underline"
                          >
                            <span>Get API Key</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-jarvis-muted">Custom Endpoint</span>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isTesting}
                          onClick={() => void handleTestConnection(provider.id)}
                          className="h-7 gap-1 px-2.5 text-xs text-jarvis-muted hover:text-jarvis-ivory"
                        >
                          <RotateCcw
                            className={`h-3 w-3 ${isTesting ? 'animate-spin text-jarvis-accent' : ''}`}
                          />
                          {isTesting ? 'Testing…' : 'Ping Test'}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MODELS & BALANCER */}
          {activeTab === 'models' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h1 className="font-display text-xl font-semibold text-jarvis-ivory">
                  Model Routing & Thinking Depth
                </h1>
                <p className="mt-1 text-xs text-jarvis-muted leading-relaxed">
                  Jarvis intelligently routes coding, reasoning, and conversational tasks across your
                  available providers.
                </p>
              </div>

              {/* Default Model Selector */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <label className="text-xs font-semibold text-jarvis-ivory">
                  Default Fallback Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(catalog?.all || ['gemini-2.0-flash', 'groq/llama-3.3-70b-versatile', 'deepseek-chat']).slice(0, 8).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleUpdateSetting({ defaultModel: m })}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-left font-mono text-xs transition',
                        settings?.defaultModel === m
                          ? 'border-jarvis-accent bg-jarvis-accent/10 text-jarvis-ivory'
                          : 'border-jarvis-border bg-jarvis-base hover:border-jarvis-borderStrong text-jarvis-sage'
                      )}
                    >
                      <span className="truncate">{m}</span>
                      {settings?.defaultModel === m && <Check className="h-3.5 w-3.5 text-jarvis-accent shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task-Aware Smart Routing Matrix */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-jarvis-accent" />
                  <h2 className="text-xs font-semibold text-jarvis-ivory">
                    Task-Aware Balancing Matrix
                  </h2>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded border border-jarvis-border/60 bg-jarvis-base p-2">
                    <span className="font-medium text-jarvis-ivory">Coding & Patching</span>
                    <span className="font-mono text-3xs text-jarvis-muted">DeepSeek V3 / Claude 3.5 Sonnet</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-jarvis-border/60 bg-jarvis-base p-2">
                    <span className="font-medium text-jarvis-ivory">Math & Complex Reasoning</span>
                    <span className="font-mono text-3xs text-jarvis-muted">DeepSeek R1 / Gemini 2.0 Flash Thinking</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-jarvis-border/60 bg-jarvis-base p-2">
                    <span className="font-medium text-jarvis-ivory">Ultra-Fast Chat & Errand Dispatch</span>
                    <span className="font-mono text-3xs text-jarvis-muted">Groq Llama 3.3 (300+ tok/s) / Flash-Lite</span>
                  </div>
                </div>
              </div>

              {/* Thinking Depth Preset */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <label className="text-xs font-semibold text-jarvis-ivory">Default Thinking Depth</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['fast', 'standard', 'deep'] as ThinkingDepth[]).map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => handleUpdateSetting({ thinkingDepth: depth })}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-center text-xs font-medium capitalize transition',
                        settings?.thinkingDepth === depth
                          ? 'border-jarvis-accent bg-jarvis-accent/15 text-jarvis-accent'
                          : 'border-jarvis-border bg-jarvis-base text-jarvis-sage hover:border-jarvis-borderStrong'
                      )}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona Style Preset */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <label className="text-xs font-semibold text-jarvis-ivory">Talking Style Persona</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['direct', 'concierge', 'academic', 'ironman'] as TalkingStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => handleUpdateSetting({ talkingStyle: style })}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-center text-xs font-medium capitalize transition',
                        settings?.talkingStyle === style
                          ? 'border-jarvis-accent bg-jarvis-accent/15 text-jarvis-accent'
                          : 'border-jarvis-border bg-jarvis-base text-jarvis-sage hover:border-jarvis-borderStrong'
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROMPTS & USER MEMORY */}
          {activeTab === 'prompts' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h1 className="font-display text-xl font-semibold text-jarvis-ivory">
                  Prompt Injection & Persistent Memory
                </h1>
                <p className="mt-1 text-xs text-jarvis-muted leading-relaxed">
                  Configure special system prompt directives and customize your persistent user memory (`USER.md`).
                  Special prompts are scanned for dangerous bypasses and destructive commands.
                </p>
              </div>

              {/* Card 1: Custom Injected Prompts & Directives */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-jarvis-accent" />
                    <span className="text-xs font-semibold text-jarvis-ivory">
                      Special Injected System Directives
                    </span>
                    {customPromptText.trim() ? (
                      promptSafety.isSafe ? (
                        <Badge variant="accent" mono className="gap-1 text-3xs">
                          <ShieldCheck className="h-3 w-3 text-emerald-400" />
                          Safety Verified
                        </Badge>
                      ) : (
                        <Badge variant="neutral" mono className="gap-1 text-3xs border-rose-500/40 text-rose-300 bg-rose-500/10">
                          <ShieldAlert className="h-3 w-3 text-rose-400" />
                          Risk Detected
                        </Badge>
                      )
                    ) : (
                      <Badge variant="neutral" mono className="text-3xs">
                        Default
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={customPromptSaving || (!promptSafety.isSafe && !riskAcknowledged)}
                    onClick={() => void handleSaveCustomPrompt()}
                    className="h-7 min-w-[80px] text-xs"
                  >
                    {customPromptSaved ? (
                      <>
                        <Check className="h-3 w-3" /> Saved
                      </>
                    ) : customPromptSaving ? (
                      'Saving…'
                    ) : (
                      'Save Prompt'
                    )}
                  </Button>
                </div>

                <p className="text-[11px] text-jarvis-muted leading-relaxed">
                  Inject special behavioral instructions, technical guidelines, or persona rules directly into Jarvis.
                </p>

                <textarea
                  value={customPromptText}
                  onChange={(e) => setCustomPromptText(e.target.value)}
                  rows={5}
                  placeholder="e.g. Always respond in bullet points, enforce strict TypeScript typechecking, prioritize security hardening..."
                  className="w-full rounded-lg border border-jarvis-border bg-jarvis-base p-3 font-mono text-xs text-jarvis-ivory placeholder:text-jarvis-muted/50 focus:border-jarvis-accent focus:outline-none leading-relaxed"
                />

                {/* Threat / Safety Assessment Feedback */}
                {customPromptText.trim() && !promptSafety.isSafe && (
                  <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3.5 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-display text-xs font-semibold text-rose-200">
                          Security Risk Warning: Potentially Dangerous Directives Detected
                        </h3>
                        <p className="mt-1 text-[11px] text-rose-300 leading-relaxed">
                          {promptSafety.warningNotice}
                        </p>
                      </div>
                    </div>

                    {/* Detected Findings */}
                    <div className="space-y-1.5 rounded border border-rose-500/20 bg-rose-950/40 p-2.5">
                      {promptSafety.findings.map((f, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5 text-3xs font-mono text-rose-300">
                          <span className="font-semibold uppercase text-rose-400">[{f.severity}]</span>
                          <span className="font-medium text-rose-200">{f.title}:</span>
                          <span className="rounded bg-rose-900/60 px-1 py-0.5 text-jarvis-ivory">
                            "{f.matchedPatterns.join(', ')}"
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Explicit Risk Acknowledgment Checkbox */}
                    <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-rose-500/20">
                      <input
                        type="checkbox"
                        checked={riskAcknowledged}
                        onChange={(e) => setRiskAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded border-rose-500/50 bg-jarvis-base text-jarvis-accent focus:ring-0"
                      />
                      <span className="text-[11px] text-rose-200 leading-normal">
                        I understand that bypassing permissions or attempting destructive operations is entirely at my own risk.
                      </span>
                    </label>
                  </div>
                )}

                {customPromptText.trim() && promptSafety.isSafe && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span className="text-[11px]">Prompt Safety Check Passed: No permission bypass or destructive directives detected.</span>
                  </div>
                )}
              </div>

              {/* Card 2: Editor Box for USER.md */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-jarvis-accent" />
                    <span className="text-xs font-semibold text-jarvis-ivory">
                      Persistent User Memory (USER.md)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {userMemoryPath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowInFolder(userMemoryPath)}
                        className="h-7 text-xs text-jarvis-muted hover:text-jarvis-ivory"
                      >
                        <FolderOpen className="h-3 w-3 mr-1" /> Explorer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void refreshUserMemory()}
                      className="h-7 text-xs"
                    >
                      Reload
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={memorySaving}
                      onClick={() => void handleSaveUserMemory()}
                      className="h-7 min-w-[70px] text-xs"
                    >
                      {memorySaved ? (
                        <>
                          <Check className="h-3 w-3" /> Saved
                        </>
                      ) : memorySaving ? (
                        'Saving…'
                      ) : (
                        'Save Memory'
                      )}
                    </Button>
                  </div>
                </div>

                <textarea
                  value={userMemoryMarkdown}
                  onChange={(e) => setUserMemoryMarkdown(e.target.value)}
                  rows={16}
                  placeholder="# Jarvis User Profile & Preferences (USER.md)&#10;..."
                  className="w-full rounded-lg border border-jarvis-border bg-jarvis-base p-3 font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none leading-relaxed"
                />

                <p className="font-mono text-3xs text-jarvis-muted">
                  Tip: Directives written here are automatically prepended to the system prompt of every model turn.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: APP & WINDOWS BEHAVIOR */}
          {activeTab === 'app' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h1 className="font-display text-xl font-semibold text-jarvis-ivory">
                  Appearance & Windows Integration
                </h1>
                <p className="mt-1 text-xs text-jarvis-muted leading-relaxed">
                  Theme preferences, companion 3D mascot behavior, startup synchronization, and support bundles.
                </p>
              </div>

              {/* Theme Switcher */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <label className="text-xs font-semibold text-jarvis-ivory">Theme Appearance</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Light (Parchment)', icon: Sun },
                    { value: 'dark', label: 'Dark (Pine & Coal)', icon: Moon },
                    { value: 'system', label: 'Windows System', icon: Monitor }
                  ].map((t) => {
                    const Icon = t.icon
                    const isSelected = (settings?.theme || 'dark') === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => handleUpdateSetting({ theme: t.value as ThemePreference })}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-3 text-xs font-medium transition',
                          isSelected
                            ? 'border-jarvis-accent bg-jarvis-accent/15 text-jarvis-accent'
                            : 'border-jarvis-border bg-jarvis-base text-jarvis-sage hover:border-jarvis-borderStrong'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3D Owl Mascot Companion */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-4">
                <h2 className="text-xs font-semibold text-jarvis-ivory">Floating 3D Mascot Companion</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-jarvis-ivory">Enable 3D Owl Companion</p>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Renders the interactive companion owl on your desktop above all windows.
                    </p>
                  </div>
                  <Switch
                    label="Toggle 3D Mascot"
                    checked={settings?.mascotEnabled !== false}
                    onCheckedChange={(checked) => handleUpdateSetting({ mascotEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-jarvis-border/60 pt-3">
                  <div>
                    <p className="text-xs font-medium text-jarvis-ivory">Reduce Mascot Motion</p>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Limits companion animations to low-frequency movement.
                    </p>
                  </div>
                  <Switch
                    label="Reduce motion"
                    checked={Boolean(settings?.reduceMotion)}
                    onCheckedChange={(checked) => handleUpdateSetting({ reduceMotion: checked })}
                  />
                </div>
              </div>

              {/* Windows Integration & Lifecycle */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-4">
                <h2 className="text-xs font-semibold text-jarvis-ivory">Windows Shell Lifecycle</h2>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-jarvis-ivory">Launch on Windows Startup</p>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Automatically starts Jarvis resident in the system tray when logging in.
                    </p>
                  </div>
                  <Switch
                    label="Launch on startup"
                    checked={Boolean(settings?.launchOnLogin)}
                    onCheckedChange={(checked) => handleUpdateSetting({ launchOnLogin: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-jarvis-border/60 pt-3">
                  <div>
                    <p className="text-xs font-medium text-jarvis-ivory">Minimize to Tray on Close</p>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Keeps Jarvis running in the background tray when the main window is closed.
                    </p>
                  </div>
                  <Switch
                    label="Minimize to tray"
                    checked={settings?.minimizeToTray !== false}
                    onCheckedChange={(checked) => handleUpdateSetting({ minimizeToTray: checked })}
                  />
                </div>
              </div>

              {/* Support Diagnostics */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xs font-semibold text-jarvis-ivory">Support Diagnostics Bundle</h2>
                  <p className="text-3xs text-jarvis-muted mt-0.5">
                    Generate a SEC-003 sanitized diagnostic export (JSON/Markdown) for troubleshooting.
                  </p>
                  {diagnosticsMessage && (
                    <p className="mt-1 font-mono text-3xs text-jarvis-accent">{diagnosticsMessage}</p>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={diagnosticsRunning}
                  onClick={() => void handleExportDiagnostics()}
                  className="shrink-0 text-xs"
                >
                  {diagnosticsRunning ? 'Exporting…' : 'Export Bundle'}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
