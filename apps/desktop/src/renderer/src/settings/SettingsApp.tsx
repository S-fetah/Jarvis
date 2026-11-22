import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Headphones,
  Loader2,
  Monitor,
  Moon,
  Mic,
  Play,
  RotateCcw,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  UploadCloud,
  Volume2,
  Wand2,
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
} from '@jarvis/protocol'
import { JarvisMark } from '../components/brand/JarvisMark'
import { Badge, Button, Switch } from '../components/ui'
import { applyTheme, readCachedTheme } from '../lib/theme'
import { cn } from '../lib/cn'
import { scanPromptSafety } from '@jarvis/protocol'
import { globalAudioPlayback } from '../lib/audio-service'

type SettingsTab = 'providers' | 'models' | 'prompts' | 'voice' | 'app'

interface BuiltinPersona {
  id: string
  name: string
  gender: 'male' | 'female'
  accent: string
  description: string
  recommendedSpeed: number
}

const BUILTIN_KOKORO_PERSONAS: BuiltinPersona[] = [
  {
    id: 'bm_george',
    name: 'George',
    gender: 'male',
    accent: 'British (UK)',
    description: 'British Butler / Jarvis-style cadence. Refined, articulate, and calm.',
    recommendedSpeed: 1.0
  },
  {
    id: 'bm_lewis',
    name: 'Lewis',
    gender: 'male',
    accent: 'British (UK)',
    description: 'British academic tone, poised and clearly enunciated.',
    recommendedSpeed: 1.0
  },
  {
    id: 'am_michael',
    name: 'Michael',
    gender: 'male',
    accent: 'American (US)',
    description: 'Deep, warm, and authoritative broadcast baritone.',
    recommendedSpeed: 1.0
  },
  {
    id: 'am_adam',
    name: 'Adam',
    gender: 'male',
    accent: 'American (US)',
    description: 'Modern, energetic narrator with crisp clarity.',
    recommendedSpeed: 1.0
  },
  {
    id: 'af_bella',
    name: 'Bella',
    gender: 'female',
    accent: 'American (US)',
    description: 'Bright, articulate, and expressive conversational voice.',
    recommendedSpeed: 1.0
  },
  {
    id: 'af_heart',
    name: 'Heart',
    gender: 'female',
    accent: 'American (US)',
    description: 'Warm, empathetic, and gentle companion voice.',
    recommendedSpeed: 1.0
  },
  {
    id: 'bf_emma',
    name: 'Emma',
    gender: 'female',
    accent: 'British (UK)',
    description: 'Elegant British tone with balanced pacing.',
    recommendedSpeed: 1.0
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'American (US)',
    description: 'Conversational, relaxed, and natural modern tone.',
    recommendedSpeed: 1.0
  }
]

interface CloudSystemPersona {
  id: string
  provider: string
  name: string
  gender: 'male' | 'female'
  description: string
}

const CLOUD_SYSTEM_PERSONAS: CloudSystemPersona[] = [
  {
    id: 'en-US-JennyNeural',
    provider: 'edge-tts',
    name: 'Jenny (Neural)',
    gender: 'female',
    description: 'Microsoft Edge Cloud Neural female voice with expressive prosody.'
  },
  {
    id: 'en-US-GuyNeural',
    provider: 'edge-tts',
    name: 'Guy (Neural)',
    gender: 'male',
    description: 'Microsoft Edge Cloud Neural male narrator voice.'
  },
  {
    id: 'Microsoft David Desktop',
    provider: 'system-speech',
    name: 'Microsoft David',
    gender: 'male',
    description: 'Windows SAPI offline standard voice (zero download, instant).'
  },
  {
    id: 'Microsoft Zira Desktop',
    provider: 'system-speech',
    name: 'Microsoft Zira',
    gender: 'female',
    description: 'Windows SAPI offline standard female voice.'
  }
]

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
  const [storageUpdating, setStorageUpdating] = useState(false)
  const [storageFeedback, setStorageFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [importingFreeApi, setImportingFreeApi] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [customPromptText, setCustomPromptText] = useState<string>('')
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false)
  const [customPromptSaving, setCustomPromptSaving] = useState(false)
  const [customPromptSaved, setCustomPromptSaved] = useState(false)

  // Voice & Zero-Shot Cloning State
  const [voiceConfig, setVoiceConfig] = useState<any>({
    enabled: true,
    sttProvider: 'groq-whisper',
    ttsProvider: 'openvoice-v2',
    ttsVoice: 'profile:javis-original',
    ttsFallbackProvider: 'system-speech',
    vadEnabled: true,
    interruptOnUserSpeech: true,
    speed: 0.95,
    language: 'en'
  })
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([])
  const [newProfileName, setNewProfileName] = useState<string>('')
  const [newProfileDesc, setNewProfileDesc] = useState<string>('')
  const [newProfileGender, setNewProfileGender] = useState<'female' | 'male'>('male')
  const [newProfileBaseVoice, setNewProfileBaseVoice] = useState<string>('bm_george')
  const [newProfileWavBase64, setNewProfileWavBase64] = useState<string | null>(null)
  const [newProfileFileName, setNewProfileFileName] = useState<string | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [autoSetActiveOnClone, setAutoSetActiveOnClone] = useState<boolean>(true)
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false)
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null)
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null)
  const [isAuditioningActive, setIsAuditioningActive] = useState<boolean>(false)
  const [personaLibraryTab, setPersonaLibraryTab] = useState<'cloned' | 'kokoro' | 'system'>('cloned')
  const [isAdvancedVoiceOpen, setIsAdvancedVoiceOpen] = useState<boolean>(false)

  // Voice Playground State
  const [playgroundText, setPlaygroundText] = useState<string>(
    'Good evening, sir. All automated systems and workspace tasks are operating at optimal efficiency.'
  )
  const [playgroundVoiceId, setPlaygroundVoiceId] = useState<string>('default')
  const [playgroundEngine, setPlaygroundEngine] = useState<string>('auto')
  const [playgroundSpeed, setPlaygroundSpeed] = useState<number>(0.95)
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false)
  const [playgroundStats, setPlaygroundStats] = useState<{
    latencyMs?: number
    durationMs?: number
    sampleRateHz?: number
    format?: string
    providerId?: string
    voice?: string
    cached?: boolean
    error?: string
  } | null>(null)
  const [cacheStats, setCacheStats] = useState<{
    entryCount: number
    totalBytes: number
    cacheDir: string
  } | null>(null)
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false)

  useEffect(() => {
    const unsub = globalAudioPlayback.onStateChange(setIsPlayingAudio)
    return () => {
      unsub()
      globalAudioPlayback.stop()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }
    }
  }, [audioPreviewUrl])

  const getActivePersonaDisplay = () => {
    const currentVoice = voiceConfig?.ttsVoice || 'profile:javis-original'
    const currentProvider = voiceConfig?.ttsProvider || 'openvoice-v2'

    if (currentVoice.startsWith('profile:')) {
      const profId = currentVoice.replace('profile:', '')
      const prof = voiceProfiles.find((p) => p.id === profId)
      if (prof) {
        return {
          id: currentVoice,
          name: prof.name,
          subtitle: prof.description || 'Custom enrolled cloned voice profile',
          engine: prof.hasOpenVoiceSE || prof.recommendedEngine === 'openvoice-v2'
            ? 'OpenVoice V2 (Deterministic Latents)'
            : 'Kokoro-82M Dual-Cached',
          offline: true,
          gender: prof.gender || 'male',
          isCloned: true
        }
      }
      if (profId === 'javis-original') {
        return {
          id: currentVoice,
          name: 'J.A.R.V.I.S. (Paul Bettany)',
          subtitle: 'Official MCU Paul Bettany neural clone with 256-dim deterministic tone color latents',
          engine: 'OpenVoice V2 (Deterministic Latents)',
          offline: true,
          gender: 'male',
          isCloned: true
        }
      }
    }

    const builtin = BUILTIN_KOKORO_PERSONAS.find((b) => b.id === currentVoice)
    if (builtin) {
      return {
        id: currentVoice,
        name: `${builtin.name} (${builtin.accent})`,
        subtitle: builtin.description,
        engine: 'Kokoro-82M ONNX',
        offline: true,
        gender: builtin.gender,
        isCloned: false
      }
    }

    const cloudSys = CLOUD_SYSTEM_PERSONAS.find((c) => c.id === currentVoice)
    if (cloudSys) {
      return {
        id: currentVoice,
        name: cloudSys.name,
        subtitle: cloudSys.description,
        engine: cloudSys.provider === 'edge-tts' ? 'Edge-TTS Cloud' : 'Windows SAPI',
        offline: cloudSys.provider !== 'edge-tts',
        gender: cloudSys.gender,
        isCloned: false
      }
    }

    return {
      id: currentVoice,
      name: currentVoice,
      subtitle: 'Active TTS Voice',
      engine: currentProvider,
      offline: currentProvider !== 'edge-tts' && currentProvider !== 'openai-tts',
      gender: 'neutral',
      isCloned: false
    }
  }

  const handleSetActiveVoice = async (options: {
    ttsVoice: string
    ttsProvider: string
    speed?: number
    name: string
  }) => {
    const updates: any = {
      ttsVoice: options.ttsVoice,
      ttsProvider: options.ttsProvider
    }
    if (options.speed !== undefined) {
      updates.speed = options.speed
    }
    setVoiceConfig((prev: any) => ({ ...prev, ...updates }))
    if (window.jarvisAPI?.voiceUpdateConfig) {
      await window.jarvisAPI.voiceUpdateConfig(updates)
    }
    setVoiceFeedback(`Active voice set to "${options.name}" (${options.ttsProvider})`)
    setTimeout(() => setVoiceFeedback(null), 3500)
  }

  const handleAuditionActiveVoice = async () => {
    if (isPlayingAudio) {
      globalAudioPlayback.stop()
      setIsPlayingAudio(false)
      setIsAuditioningActive(false)
      return
    }
    setIsAuditioningActive(true)
    try {
      const text = 'Good evening, sir. All automated systems and workspace tasks are operating at optimal efficiency.'
      const res = await window.jarvisAPI?.voiceSynthesize?.(text, {
        voice: voiceConfig?.ttsVoice,
        providerId: voiceConfig?.ttsProvider,
        speed: voiceConfig?.speed || 0.95
      })
      if (res?.data) {
        await globalAudioPlayback.play(res.data, res.sampleRateHz || 24000)
      }
    } catch (err: any) {
      console.error('[SettingsApp] Audition error:', err)
      setVoiceFeedback(`Audition error: ${err.message || err}`)
      setTimeout(() => setVoiceFeedback(null), 4000)
    } finally {
      setIsAuditioningActive(false)
    }
  }

  const handlePreviewPersona = async (voiceKey: string, providerId?: string, speakerWav?: string) => {
    if (testingVoiceId === voiceKey && isPlayingAudio) {
      globalAudioPlayback.stop()
      setIsPlayingAudio(false)
      setTestingVoiceId(null)
      return
    }
    setTestingVoiceId(voiceKey)
    try {
      const sampleText = 'Good evening, sir. All systems are online and awaiting your command.'
      const res = await window.jarvisAPI?.voiceSynthesize?.(sampleText, {
        voice: voiceKey,
        providerId: providerId || 'auto',
        speakerWav: speakerWav,
        speed: voiceKey === 'profile:javis-original' ? 0.95 : (voiceConfig?.speed || 1.0)
      })
      if (res?.data) {
        await globalAudioPlayback.play(res.data, res.sampleRateHz || 24000)
      }
    } catch (err: any) {
      console.error('[SettingsApp] Preview error:', err)
      setVoiceFeedback(`Preview failed: ${err.message || err}`)
      setTimeout(() => setVoiceFeedback(null), 4000)
    } finally {
      setTestingVoiceId(null)
    }
  }

  const handlePlaygroundSynthesize = async (): Promise<void> => {
    if (!playgroundText.trim() || isSynthesizing) return
    setIsSynthesizing(true)
    setPlaygroundStats(null)
    const startTime = Date.now()

    try {
      if (!window.jarvisAPI?.voiceSynthesize) {
        throw new Error('voiceSynthesize API is not available')
      }

      let speakerWav: string | undefined = undefined
      let voiceName: string | undefined = undefined

      if (playgroundVoiceId === 'default') {
        const activeVoice = voiceConfig?.ttsVoice || 'profile:javis-original'
        if (activeVoice.startsWith('profile:')) {
          const profId = activeVoice.replace('profile:', '')
          const prof = voiceProfiles.find((p) => p.id === profId)
          if (prof) {
            speakerWav = prof.folderPath
            voiceName = `profile:${prof.id}`
          } else {
            voiceName = activeVoice
          }
        } else {
          voiceName = activeVoice
        }
      } else if (playgroundVoiceId.startsWith('profile:')) {
        const profId = playgroundVoiceId.replace('profile:', '')
        const prof = voiceProfiles.find((p) => p.id === profId)
        if (prof) {
          speakerWav = prof.folderPath
          voiceName = `profile:${prof.id}`
        }
      } else if (playgroundVoiceId.startsWith('voice:')) {
        voiceName = playgroundVoiceId.replace('voice:', '')
      }

      const providerId = playgroundEngine !== 'auto' ? playgroundEngine : undefined

      const res = await window.jarvisAPI.voiceSynthesize(playgroundText.trim(), {
        speed: playgroundSpeed,
        speakerWav,
        voice: voiceName,
        providerId
      })

      const latencyMs = Date.now() - startTime
      setPlaygroundStats({
        latencyMs,
        durationMs: res?.durationMs,
        sampleRateHz: res?.sampleRateHz,
        format: res?.format,
        providerId: res?.providerId || providerId || 'auto',
        voice: res?.voice || voiceName || 'default',
        cached: res?.cached
      })
      void loadCacheStats()

      if (res?.data && res.data.length > 0) {
        await globalAudioPlayback.play(res.data, res.sampleRateHz || 24000)
      } else {
        throw new Error('No audio bytes returned from synthesizer')
      }
    } catch (err: any) {
      console.error('[Voice Playground] Synthesis error:', err)
      setPlaygroundStats({ error: err.message || String(err) })
    } finally {
      setIsSynthesizing(false)
    }
  }

  const loadCacheStats = async (): Promise<void> => {
    if (window.jarvisAPI?.voiceGetAudioCacheStats) {
      try {
        const stats = await window.jarvisAPI.voiceGetAudioCacheStats()
        setCacheStats(stats)
      } catch (e) {
        console.warn('Failed to load audio cache stats:', e)
      }
    }
  }

  const handleClearAudioCache = async (): Promise<void> => {
    if (isClearingCache || !window.jarvisAPI?.voiceClearAudioCache) return
    setIsClearingCache(true)
    try {
      const res = await window.jarvisAPI.voiceClearAudioCache()
      await loadCacheStats()
      setVoiceFeedback(`Audio cache cleared (${res.clearedCount} files removed).`)
      setTimeout(() => setVoiceFeedback(null), 3500)
    } catch (e: any) {
      setVoiceFeedback(`Failed to clear audio cache: ${e.message || e}`)
      setTimeout(() => setVoiceFeedback(null), 4000)
    } finally {
      setIsClearingCache(false)
    }
  }

  // Initialize theme and load all state on mount
  useEffect(() => {
    const cached = readCachedTheme()
    applyTheme(cached)

    // Parse initial tab from URL hash if provided (#settings?tab=prompts)
    try {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.split('?')[1] || '')
      const tabParam = params.get('tab') as SettingsTab | null
      if (tabParam && ['providers', 'models', 'prompts', 'voice', 'app'].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    } catch {
      // Ignore
    }

    // Listen to tab navigation events from main process
    const unsubTab = window.jarvisAPI?.onNavigateSettingsTab?.((tab) => {
      if (['providers', 'models', 'prompts', 'voice', 'app'].includes(tab)) {
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

    // Load Voice Config & Enrolled Profiles
    refreshVoiceData()

    return () => {
      unsubTab?.()
    }
  }, [])

  const refreshVoiceData = async (): Promise<void> => {
    try {
      if (window.jarvisAPI?.voiceGetConfig) {
        const cfg = await window.jarvisAPI.voiceGetConfig()
        if (cfg) setVoiceConfig(cfg)
      }
      if (window.jarvisAPI?.voiceListProfiles) {
        const profs = await window.jarvisAPI.voiceListProfiles()
        if (profs) setVoiceProfiles(profs)
      }
      void loadCacheStats()
    } catch (err) {
      console.warn('[SettingsApp] Failed to load voice config or profiles:', err)
    }
  }

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

  const applySqliteStorageFolder = async (folderPath: string | null): Promise<void> => {
    if (!window.jarvisAPI?.setSqliteStorageFolder) return
    setStorageUpdating(true)
    setStorageFeedback(null)
    try {
      const res = await window.jarvisAPI.setSqliteStorageFolder(folderPath)
      if (!res.success) {
        setStorageFeedback({ ok: false, text: res.error || 'Failed to update SQLite storage folder.' })
        return
      }
      if (window.jarvisAPI.getSettings) {
        const refreshed = await window.jarvisAPI.getSettings()
        setSettings(refreshed)
        if (refreshed.theme) applyTheme(refreshed.theme)
      }
      if (res.mode === 'migrated') {
        setStorageFeedback({
          ok: true,
          text: `Database migrated to ${res.sqliteStoragePath}\\jarvis.sqlite (previous file kept as backup).`
        })
      } else if (res.mode === 'loaded_existing') {
        setStorageFeedback({
          ok: true,
          text: `Switched to existing database at ${res.sqliteStoragePath}\\jarvis.sqlite.`
        })
      } else {
        setStorageFeedback({ ok: true, text: 'SQLite storage folder confirmed.' })
      }
    } catch (err: any) {
      setStorageFeedback({ ok: false, text: err?.message || 'Unexpected error changing storage folder.' })
    } finally {
      setStorageUpdating(false)
    }
  }

  const handleChooseSqliteFolder = async (): Promise<void> => {
    if (!window.jarvisAPI?.selectSqliteStorageFolder) return
    const selected = await window.jarvisAPI.selectSqliteStorageFolder()
    if (selected) {
      await applySqliteStorageFolder(selected)
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
  const activePersona = getActivePersonaDisplay()

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
              onClick={() => setActiveTab('voice')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                activeTab === 'voice'
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:bg-jarvis-hover hover:text-jarvis-ivory'
              )}
            >
              <Mic className="h-4 w-4 shrink-0" />
              <span>Voice & Cloning</span>
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

          {/* TAB: VOICE & CLONING STUDIO */}
          {activeTab === 'voice' && (
            <div className="max-w-3xl space-y-6">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-xl font-semibold text-jarvis-ivory flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-jarvis-accent" />
                    <span>Voice & Cloning Studio</span>
                  </h1>
                  <p className="mt-1 text-xs text-jarvis-muted leading-relaxed">
                    Personalize J.A.R.V.I.S.'s voice, enroll high-fidelity zero-shot voice clones, and test neural speech generation in real-time.
                  </p>
                </div>
                <Badge variant="outline" className="text-3xs font-mono bg-jarvis-accent/10 text-jarvis-accent border-jarvis-accent/30">
                  ADR-009 Dual-Engine Active
                </Badge>
              </div>

              {/* Feedback toast banner */}
              {voiceFeedback && (
                <div className="flex items-center gap-2 rounded-lg border border-jarvis-accent/40 bg-jarvis-accent/10 p-3 text-xs text-jarvis-accent">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{voiceFeedback}</span>
                </div>
              )}

              {/* 1. HERO CARD: ACTIVE J.A.R.V.I.S. VOICE PERSONA */}
              <div className="relative overflow-hidden rounded-xl border border-jarvis-accent/30 bg-gradient-to-br from-jarvis-surface via-jarvis-surface to-jarvis-accent/5 p-5 shadow-raised">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-jarvis-accent/40 bg-jarvis-accent/15 text-jarvis-accent">
                      {isPlayingAudio ? (
                        <div className="flex items-center gap-0.5">
                          <span className="h-4 w-1 animate-pulse bg-jarvis-accent rounded-full" />
                          <span className="h-6 w-1 animate-pulse delay-75 bg-jarvis-accent rounded-full" />
                          <span className="h-3 w-1 animate-pulse delay-150 bg-jarvis-accent rounded-full" />
                        </div>
                      ) : (
                        <Volume2 className="h-6 w-6" />
                      )}
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-jarvis-ivory">
                          {activePersona.name}
                        </h2>
                        <Badge variant="outline" className="text-3xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          Active Agent Voice
                        </Badge>
                        <Badge variant="outline" className="text-3xs font-mono bg-jarvis-base text-jarvis-accent border-jarvis-accent/30">
                          {activePersona.engine}
                        </Badge>
                        <Badge variant="outline" className="text-3xs font-mono bg-jarvis-base text-jarvis-muted border-jarvis-border">
                          {activePersona.offline ? '100% Offline CPU' : 'Cloud Neural'}
                        </Badge>
                      </div>
                      <p className="text-xs text-jarvis-muted">
                        {activePersona.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Audition Playback Button */}
                  <div className="shrink-0 w-full sm:w-auto">
                    <Button
                      variant={isAuditioningActive || (isPlayingAudio && testingVoiceId === null) ? 'secondary' : 'primary'}
                      size="sm"
                      className="h-9 w-full sm:w-auto px-4 text-xs font-semibold flex items-center justify-center gap-2"
                      onClick={handleAuditionActiveVoice}
                    >
                      {isAuditioningActive ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Generating Voice...</span>
                        </>
                      ) : isPlayingAudio ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-current text-red-400" />
                          <span>Stop Playing</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Audition J.A.R.V.I.S. Voice</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Quick Cadence / Speed Control */}
                <div className="mt-4 pt-3 border-t border-jarvis-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-jarvis-muted">Speech Cadence Rate:</span>
                    <span className="font-mono text-jarvis-accent font-semibold">{voiceConfig?.speed || 0.95}x</span>
                    <span className="text-3xs text-jarvis-muted/70">
                      {(voiceConfig?.speed || 0.95) === 0.95 ? '(Official Bettany J.A.R.V.I.S. cadence)' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const val = 0.95
                        setVoiceConfig((p: any) => ({ ...p, speed: val }))
                        window.jarvisAPI?.voiceUpdateConfig?.({ speed: val })
                      }}
                      className={cn(
                        "text-3xs px-2 py-0.5 rounded border transition font-mono",
                        (voiceConfig?.speed || 0.95) === 0.95
                          ? "border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10"
                          : "border-jarvis-border text-jarvis-muted hover:text-jarvis-ivory"
                      )}
                    >
                      0.95x (J.A.R.V.I.S.)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = 1.0
                        setVoiceConfig((p: any) => ({ ...p, speed: val }))
                        window.jarvisAPI?.voiceUpdateConfig?.({ speed: val })
                      }}
                      className={cn(
                        "text-3xs px-2 py-0.5 rounded border transition font-mono",
                        (voiceConfig?.speed || 0.95) === 1.0
                          ? "border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10"
                          : "border-jarvis-border text-jarvis-muted hover:text-jarvis-ivory"
                      )}
                    >
                      1.0x (Standard)
                    </button>
                    <input
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.05"
                      value={voiceConfig?.speed || 0.95}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setVoiceConfig((p: any) => ({ ...p, speed: val }))
                        window.jarvisAPI?.voiceUpdateConfig?.({ speed: val })
                      }}
                      className="w-28 accent-jarvis-accent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 2. PERSONA LIBRARY (Tabs: Cloned | Kokoro | Cloud) */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-jarvis-border/60 pb-3">
                  <div>
                    <h2 className="text-xs font-semibold text-jarvis-ivory flex items-center gap-1.5">
                      <Headphones className="h-4 w-4 text-jarvis-accent" />
                      <span>Voice Persona Library</span>
                    </h2>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Choose from enrolled neural clones or built-in CPU neural speakers.
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-jarvis-base rounded-lg p-1 border border-jarvis-border">
                    <button
                      type="button"
                      onClick={() => setPersonaLibraryTab('cloned')}
                      className={cn(
                        "px-2.5 py-1 text-3xs font-medium rounded-md transition",
                        personaLibraryTab === 'cloned'
                          ? "bg-jarvis-surface text-jarvis-ivory shadow-sm border border-jarvis-border"
                          : "text-jarvis-muted hover:text-jarvis-ivory"
                      )}
                    >
                      Cloned Personas ({voiceProfiles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonaLibraryTab('kokoro')}
                      className={cn(
                        "px-2.5 py-1 text-3xs font-medium rounded-md transition",
                        personaLibraryTab === 'kokoro'
                          ? "bg-jarvis-surface text-jarvis-ivory shadow-sm border border-jarvis-border"
                          : "text-jarvis-muted hover:text-jarvis-ivory"
                      )}
                    >
                      Kokoro-82M CPU ({BUILTIN_KOKORO_PERSONAS.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonaLibraryTab('system')}
                      className={cn(
                        "px-2.5 py-1 text-3xs font-medium rounded-md transition",
                        personaLibraryTab === 'system'
                          ? "bg-jarvis-surface text-jarvis-ivory shadow-sm border border-jarvis-border"
                          : "text-jarvis-muted hover:text-jarvis-ivory"
                      )}
                    >
                      Cloud & SAPI ({CLOUD_SYSTEM_PERSONAS.length})
                    </button>
                  </div>
                </div>

                {/* TAB CONTENT: CLONED PERSONAS */}
                {personaLibraryTab === 'cloned' && (
                  <div className="space-y-3">
                    {voiceProfiles.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-jarvis-border p-6 text-center">
                        <p className="text-xs text-jarvis-muted">No custom voice profiles enrolled yet.</p>
                        <p className="text-3xs text-jarvis-muted/70 mt-1">
                          Enroll an audio clip in the Voice Studio below to clone any voice!
                        </p>
                      </div>
                    ) : (
                      voiceProfiles.map((p) => {
                        const isCurrentActive = voiceConfig?.ttsVoice === `profile:${p.id}`
                        const isOriginalJarvis = p.id === 'javis-original'

                        return (
                          <div
                            key={p.id}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3.5 transition",
                              isCurrentActive
                                ? "border-jarvis-accent/60 bg-jarvis-accent/5 shadow-sm"
                                : "border-jarvis-border bg-jarvis-base hover:border-jarvis-borderStrong"
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-jarvis-ivory">
                                  {isOriginalJarvis ? '⭐ ' : ''}{p.name}
                                </span>
                                {isCurrentActive && (
                                  <Badge variant="outline" className="text-3xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                    ✓ Active Voice
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-3xs bg-jarvis-surface text-jarvis-accent border-jarvis-accent/30 font-mono">
                                  {p.hasOpenVoiceSE ? 'OpenVoice V2 Tone Clone' : 'Dual-Cached'}
                                </Badge>
                                <Badge variant="outline" className="text-3xs font-mono bg-jarvis-surface text-jarvis-ivory border-jarvis-border">
                                  {p.gender === 'female' ? '👩 Female' : '👨 Male'}
                                </Badge>
                                {isOriginalJarvis && (
                                  <Badge variant="outline" className="text-3xs bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono">
                                    Official J.A.R.V.I.S. Default
                                  </Badge>
                                )}
                              </div>
                              <p className="text-3xs text-jarvis-muted">
                                {p.description || (isOriginalJarvis
                                  ? 'MCU Paul Bettany calibrated voice with 256-dim deterministic tone color latents and warm broadcast EQ.'
                                  : 'Custom zero-shot cloned voice profile.')}
                              </p>
                              <div className="flex items-center gap-3 font-mono text-3xs text-jarvis-muted/80">
                                <span>Embedding: {p.hasOpenVoiceSE ? '✓ 256-dim SE' : '—'}</span>
                                <span>Base Cadence: {p.baseVoice || (p.gender === 'female' ? 'af_bella' : 'bm_george')}</span>
                                {isOriginalJarvis && <span>Recommended Speed: 0.95x</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 text-3xs flex items-center gap-1.5"
                                disabled={testingVoiceId === `profile:${p.id}`}
                                onClick={() => handlePreviewPersona(`profile:${p.id}`, p.hasOpenVoiceSE ? 'openvoice-v2' : 'kokoro-82m', p.folderPath)}
                              >
                                {testingVoiceId === `profile:${p.id}` ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Playing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3 w-3" />
                                    <span>Preview</span>
                                  </>
                                )}
                              </Button>

                              {isCurrentActive ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled
                                  className="h-7 text-3xs font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                                >
                                  <Check className="h-3 w-3 mr-1" /> Active
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-7 text-3xs font-semibold"
                                  onClick={() => handleSetActiveVoice({
                                    ttsVoice: `profile:${p.id}`,
                                    ttsProvider: p.hasOpenVoiceSE ? 'openvoice-v2' : 'kokoro-82m',
                                    speed: isOriginalJarvis ? 0.95 : (voiceConfig?.speed || 1.0),
                                    name: p.name
                                  })}
                                >
                                  Set as Active Voice
                                </Button>
                              )}

                              {!isOriginalJarvis && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-jarvis-muted hover:text-red-400 hover:bg-red-500/10"
                                  onClick={async () => {
                                    if (window.jarvisAPI?.voiceDeleteProfile) {
                                      await window.jarvisAPI.voiceDeleteProfile(p.id)
                                      if (isCurrentActive) {
                                        await handleSetActiveVoice({
                                          ttsVoice: 'profile:javis-original',
                                          ttsProvider: 'openvoice-v2',
                                          speed: 0.95,
                                          name: 'J.A.R.V.I.S. (Paul Bettany)'
                                        })
                                      }
                                      refreshVoiceData()
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {/* TAB CONTENT: KOKORO-82M */}
                {personaLibraryTab === 'kokoro' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BUILTIN_KOKORO_PERSONAS.map((b) => {
                      const isCurrentActive = voiceConfig?.ttsVoice === b.id && voiceConfig?.ttsProvider === 'kokoro-82m'

                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "flex flex-col justify-between rounded-lg border p-3 transition space-y-2.5",
                            isCurrentActive
                              ? "border-jarvis-accent/60 bg-jarvis-accent/5 shadow-sm"
                              : "border-jarvis-border bg-jarvis-base hover:border-jarvis-borderStrong"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-jarvis-ivory">{b.name}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-3xs font-mono bg-jarvis-surface text-jarvis-muted border-jarvis-border">
                                  {b.accent}
                                </Badge>
                                <Badge variant="outline" className="text-3xs font-mono bg-jarvis-surface text-jarvis-ivory border-jarvis-border">
                                  {b.gender === 'female' ? '👩' : '👨'}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-3xs text-jarvis-muted">{b.description}</p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-jarvis-border/40">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 text-3xs flex items-center gap-1"
                              disabled={testingVoiceId === b.id}
                              onClick={() => handlePreviewPersona(b.id, 'kokoro-82m')}
                            >
                              {testingVoiceId === b.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              <span>Preview</span>
                            </Button>

                            {isCurrentActive ? (
                              <Badge variant="outline" className="text-3xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                ✓ Active
                              </Badge>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                className="h-6 text-3xs font-semibold"
                                onClick={() => handleSetActiveVoice({
                                  ttsVoice: b.id,
                                  ttsProvider: 'kokoro-82m',
                                  speed: 1.0,
                                  name: `${b.name} (${b.accent})`
                                })}
                              >
                                Set as Active
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* TAB CONTENT: CLOUD & SAPI */}
                {personaLibraryTab === 'system' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CLOUD_SYSTEM_PERSONAS.map((c) => {
                      const isCurrentActive = voiceConfig?.ttsVoice === c.id && voiceConfig?.ttsProvider === c.provider

                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "flex flex-col justify-between rounded-lg border p-3 transition space-y-2.5",
                            isCurrentActive
                              ? "border-jarvis-accent/60 bg-jarvis-accent/5 shadow-sm"
                              : "border-jarvis-border bg-jarvis-base hover:border-jarvis-borderStrong"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-jarvis-ivory">{c.name}</span>
                              <Badge variant="outline" className="text-3xs font-mono bg-jarvis-surface text-jarvis-accent border-jarvis-accent/30">
                                {c.provider}
                              </Badge>
                            </div>
                            <p className="text-3xs text-jarvis-muted">{c.description}</p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-jarvis-border/40">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 text-3xs flex items-center gap-1"
                              disabled={testingVoiceId === c.id}
                              onClick={() => handlePreviewPersona(c.id, c.provider)}
                            >
                              {testingVoiceId === c.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              <span>Preview</span>
                            </Button>

                            {isCurrentActive ? (
                              <Badge variant="outline" className="text-3xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                ✓ Active
                              </Badge>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                className="h-6 text-3xs font-semibold"
                                onClick={() => handleSetActiveVoice({
                                  ttsVoice: c.id,
                                  ttsProvider: c.provider,
                                  speed: 1.0,
                                  name: c.name
                                })}
                              >
                                Set as Active
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 3. VOICE STUDIO — CLONE A NEW VOICE */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-semibold text-jarvis-ivory flex items-center gap-1.5">
                      <Wand2 className="h-4 w-4 text-jarvis-accent" />
                      <span>Voice Studio — Clone a New Voice</span>
                    </h2>
                    <p className="text-3xs text-jarvis-muted mt-0.5">
                      Upload a 3–10 second voice recording to extract and precompute tone color embeddings instantly.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-3xs font-mono">
                    Zero-Shot Cloning
                  </Badge>
                </div>

                <div className="space-y-3 rounded-lg border border-jarvis-border/80 bg-jarvis-base/60 p-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-jarvis-ivory">Voice Persona Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Tony Stark, Morgan Freeman, FRIDAY"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-jarvis-ivory">Description (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Crisp, witty assistant persona"
                        value={newProfileDesc}
                        onChange={(e) => setNewProfileDesc(e.target.value)}
                        className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-jarvis-ivory">Persona Gender</label>
                      <select
                        value={newProfileGender}
                        onChange={(e) => {
                          const g = e.target.value as 'female' | 'male'
                          setNewProfileGender(g)
                          setNewProfileBaseVoice(g === 'female' ? 'af_bella' : 'bm_george')
                        }}
                        className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none font-mono"
                      >
                        <option value="male">👨 Male Persona</option>
                        <option value="female">👩 Female Persona</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-jarvis-ivory">Base Acoustic Rhythm</label>
                      <select
                        value={newProfileBaseVoice}
                        onChange={(e) => setNewProfileBaseVoice(e.target.value)}
                        className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                      >
                        {newProfileGender === 'female' ? (
                          <>
                            <option value="af_bella">Bella (Crisp & Articulate, American)</option>
                            <option value="af_heart">Heart (Warm & Natural, American)</option>
                            <option value="bf_emma">Emma (British Elegant)</option>
                            <option value="af_sarah">Sarah (Conversational, American)</option>
                          </>
                        ) : (
                          <>
                            <option value="bm_george">George (British Butler / Jarvis-style)</option>
                            <option value="bm_lewis">Lewis (British Articulate)</option>
                            <option value="am_michael">Michael (Deep & Authoritative)</option>
                            <option value="am_adam">Adam (Broadcast-ready)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Audio Upload Dropzone & Player */}
                  <div className="pt-2 border-t border-jarvis-border/40 space-y-2">
                    <label className="text-3xs font-medium text-jarvis-ivory">Reference Audio Clip (WAV, MP3, M4A, 3–15 sec)</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <input
                        type="file"
                        id="voice-sample-upload"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
                          const preview = URL.createObjectURL(file)
                          setAudioPreviewUrl(preview)
                          setNewProfileFileName(file.name)
                          const reader = new FileReader()
                          reader.onload = () => {
                            const res = reader.result as string
                            const base64 = res.split(',')[1] || res
                            setNewProfileWavBase64(base64)
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                      <label
                        htmlFor="voice-sample-upload"
                        className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs font-medium text-jarvis-ivory hover:border-jarvis-accent/60 hover:bg-jarvis-hover transition"
                      >
                        <UploadCloud className="h-4 w-4 text-jarvis-accent" />
                        <span>{newProfileFileName ? `Clip: ${newProfileFileName}` : 'Choose Audio File...'}</span>
                      </label>

                      {audioPreviewUrl && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <audio src={audioPreviewUrl} controls className="h-8 w-60 rounded bg-jarvis-base" />
                          <button
                            type="button"
                            onClick={() => {
                              if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
                              setAudioPreviewUrl(null)
                              setNewProfileFileName(null)
                              setNewProfileWavBase64(null)
                            }}
                            className="text-3xs text-jarvis-muted hover:text-red-400 p-1"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Auto-active Checkbox */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-jarvis-border/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-jarvis-ivory">
                      <input
                        type="checkbox"
                        checked={autoSetActiveOnClone}
                        onChange={(e) => setAutoSetActiveOnClone(e.target.checked)}
                        className="accent-jarvis-accent rounded"
                      />
                      <span>Make this newly cloned voice the active Jarvis voice immediately</span>
                    </label>

                    <Button
                      variant="primary"
                      size="sm"
                      className="h-8 text-xs font-semibold px-4"
                      disabled={isEnrolling || !newProfileName.trim()}
                      onClick={async () => {
                        setIsEnrolling(true)
                        try {
                          let wavB64 = newProfileWavBase64
                          if (!wavB64) {
                            const pcm = new Int16Array(16000 * 3)
                            for (let i = 0; i < pcm.length; i++) {
                              pcm[i] = Math.round(14000 * Math.sin((2 * Math.PI * 180 * i) / 16000))
                            }
                            const wavBytes = new Uint8Array(44 + pcm.length * 2)
                            const view = new DataView(wavBytes.buffer)
                            view.setUint32(0, 0x52494646, false)
                            view.setUint32(4, 36 + pcm.length * 2, true)
                            view.setUint32(8, 0x57415645, false)
                            view.setUint32(12, 0x666d7420, false)
                            view.setUint32(16, 16, true)
                            view.setUint16(20, 1, true)
                            view.setUint16(22, 1, true)
                            view.setUint32(24, 16000, true)
                            view.setUint32(28, 32000, true)
                            view.setUint16(32, 2, true)
                            view.setUint16(34, 16, true)
                            view.setUint32(36, 0x64617461, false)
                            view.setUint32(40, pcm.length * 2, true)
                            new Int16Array(wavBytes.buffer, 44).set(pcm)
                            let binary = ''
                            for (let i = 0; i < wavBytes.length; i++) binary += String.fromCharCode(wavBytes[i])
                            wavB64 = btoa(binary)
                          }

                          if (window.jarvisAPI?.voiceCreateProfile) {
                            const created = await window.jarvisAPI.voiceCreateProfile(newProfileName, wavB64, newProfileDesc, {
                              gender: newProfileGender,
                              baseVoice: newProfileBaseVoice
                            })

                            if (autoSetActiveOnClone && created?.id) {
                              await handleSetActiveVoice({
                                ttsVoice: `profile:${created.id}`,
                                ttsProvider: 'openvoice-v2',
                                speed: 1.0,
                                name: newProfileName
                              })
                            }

                            setNewProfileName('')
                            setNewProfileDesc('')
                            setNewProfileWavBase64(null)
                            setNewProfileFileName(null)
                            if (audioPreviewUrl) {
                              URL.revokeObjectURL(audioPreviewUrl)
                              setAudioPreviewUrl(null)
                            }
                            setVoiceFeedback(`Voice profile "${newProfileName}" cloned successfully!`)
                            setTimeout(() => setVoiceFeedback(null), 4000)
                            await refreshVoiceData()
                          }
                        } catch (err: any) {
                          setVoiceFeedback(`Cloning failed: ${err.message || err}`)
                        } finally {
                          setIsEnrolling(false)
                        }
                      }}
                    >
                      {isEnrolling ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          <span>Extracting Neural Embeddings...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          <span>Clone Voice & Precompute Latents</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 4. INTERACTIVE VOICE PLAYGROUND */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-jarvis-accent" />
                    <h2 className="text-xs font-semibold text-jarvis-ivory">Interactive Speech Playground</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlayingAudio && (
                      <span className="flex items-center gap-1.5 text-3xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        Synthesizing & Playing
                      </span>
                    )}
                    <Badge variant="outline" className="text-3xs font-mono">
                      Paragraph Testing
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-jarvis-muted leading-relaxed">
                  Enter or paste any custom text to test pronunciation, cadence, and latency across any voice persona or engine.
                </p>

                {/* Selectors Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-jarvis-ivory">Voice to Test</label>
                    <select
                      value={playgroundVoiceId}
                      onChange={(e) => setPlaygroundVoiceId(e.target.value)}
                      className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                    >
                      <option value="default">★ Current Active Voice ({activePersona.name})</option>
                      {voiceProfiles.length > 0 && (
                        <optgroup label="Cloned Voice Profiles">
                          {voiceProfiles.map((p) => (
                            <option key={p.id} value={`profile:${p.id}`}>
                              {p.id === 'javis-original' ? '⭐ ' : ''}{p.name} ({p.hasOpenVoiceSE ? 'OpenVoice V2' : 'Kokoro-style'})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Kokoro-82M CPU Voices">
                        {BUILTIN_KOKORO_PERSONAS.map((b) => (
                          <option key={b.id} value={`voice:${b.id}`}>
                            {b.name} ({b.accent})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Cloud & System Voices">
                        {CLOUD_SYSTEM_PERSONAS.map((c) => (
                          <option key={c.id} value={`voice:${c.id}`}>
                            {c.name} ({c.provider})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-jarvis-ivory">Engine Mode</label>
                    <select
                      value={playgroundEngine}
                      onChange={(e) => setPlaygroundEngine(e.target.value)}
                      className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-2.5 py-1.5 font-mono text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                    >
                      <option value="auto">Auto (Smart Engine Routing)</option>
                      <option value="openvoice-v2">OpenVoice V2 (Deterministic J.A.R.V.I.S. Clone)</option>
                      <option value="kokoro-82m">Kokoro-82M ONNX (Sub-150ms TTFA)</option>
                      <option value="edge-tts">Microsoft Edge-TTS (Cloud Neural)</option>
                      <option value="system-speech">Windows SAPI (100% Offline)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-jarvis-ivory">Playback Speed</label>
                      <span className="font-mono text-xs text-jarvis-accent">{playgroundSpeed.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={playgroundSpeed}
                      onChange={(e) => setPlaygroundSpeed(parseFloat(e.target.value))}
                      className="w-full accent-jarvis-accent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick Presets Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-3xs font-semibold uppercase tracking-wider text-jarvis-muted">Presets:</span>
                    <span className="text-3xs font-mono text-jarvis-muted/70">{playgroundText.length} characters</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('Good evening, sir. All automated systems and workspace tasks are operating at optimal efficiency.')}
                      className="rounded border border-jarvis-border/80 bg-jarvis-base px-2 py-1 text-3xs text-jarvis-muted hover:border-jarvis-accent/50 hover:text-jarvis-ivory transition font-mono"
                    >
                      👋 Greeting
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('I have calibrated the tone color converters and speech boundary detectors. We are fully operational and ready for your instructions, sir.')}
                      className="rounded border border-jarvis-border/80 bg-jarvis-base px-2 py-1 text-3xs text-jarvis-muted hover:border-jarvis-accent/50 hover:text-jarvis-ivory transition font-mono"
                    >
                      🛡️ J.A.R.V.I.S. Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('The asynchronous event loop in Node.js orchestrates non-blocking I/O operations through the libuv thread pool. Let us examine the call stack and microtask queue.')}
                      className="rounded border border-jarvis-border/80 bg-jarvis-base px-2 py-1 text-3xs text-jarvis-muted hover:border-jarvis-accent/50 hover:text-jarvis-ivory transition font-mono"
                    >
                      💻 Technical Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('In a world where intelligence runs quietly on your own workstation, privacy is not a compromise—it is the default architecture. Zero external dependencies, pure local execution, and total sovereignty over your data.')}
                      className="rounded border border-jarvis-border/80 bg-jarvis-base px-2 py-1 text-3xs text-jarvis-muted hover:border-jarvis-accent/50 hover:text-jarvis-ivory transition font-mono"
                    >
                      📖 Long Story
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('All automated test suites passed with zero errors. System ready.')}
                      className="rounded border border-jarvis-border/80 bg-jarvis-base px-2 py-1 text-3xs text-jarvis-muted hover:border-jarvis-accent/50 hover:text-jarvis-ivory transition font-mono"
                    >
                      ⚡ Quick Ping
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundText('')}
                      className="rounded border border-jarvis-border/60 bg-transparent px-2 py-1 text-3xs text-jarvis-muted/70 hover:text-jarvis-ivory transition font-mono ml-auto"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  rows={4}
                  value={playgroundText}
                  onChange={(e) => setPlaygroundText(e.target.value)}
                  placeholder="Enter or paste paragraphs of text to test how the voice sounds and enunciates..."
                  className="w-full rounded-md border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs leading-relaxed text-jarvis-ivory placeholder:text-jarvis-muted/70 focus:border-jarvis-accent focus:outline-none"
                />

                {/* Stats / Error Banner */}
                {playgroundStats && (
                  <div
                    className={cn(
                      'rounded-lg border p-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2',
                      playgroundStats.error
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    )}
                  >
                    {playgroundStats.error ? (
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                        <span>Synthesis Error: {playgroundStats.error}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check className="h-3.5 w-3.5" /> Synthesized
                        </span>
                        {playgroundStats.cached && (
                          <Badge variant="outline" className="text-3xs bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-mono flex items-center gap-1">
                            <Zap className="h-3 w-3 fill-current text-emerald-400" />
                            Session Cache Hit
                          </Badge>
                        )}
                        {playgroundStats.providerId && (
                          <Badge variant="outline" className="text-3xs bg-jarvis-accent/15 text-jarvis-accent border-jarvis-accent/40 font-mono">
                            Engine: {playgroundStats.providerId}
                          </Badge>
                        )}
                        {playgroundStats.voice && (
                          <Badge variant="outline" className="text-3xs bg-jarvis-base text-jarvis-ivory border-jarvis-border font-mono">
                            Voice: {playgroundStats.voice}
                          </Badge>
                        )}
                        {playgroundStats.latencyMs !== undefined && (
                          <span className="text-jarvis-muted">Latency: <span className="text-jarvis-ivory font-bold">{playgroundStats.latencyMs}ms</span></span>
                        )}
                        {playgroundStats.durationMs !== undefined && (
                          <span className="text-jarvis-muted">Duration: <span className="text-jarvis-ivory font-bold">{(playgroundStats.durationMs / 1000).toFixed(1)}s</span></span>
                        )}
                        {playgroundStats.sampleRateHz !== undefined && (
                          <span className="text-jarvis-muted">Rate: <span className="text-jarvis-ivory font-bold">{playgroundStats.sampleRateHz}Hz</span></span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-3xs text-jarvis-muted">
                    Tip: Press "Synthesize & Play" to render speech with active tone vectors.
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlayingAudio && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          globalAudioPlayback.stop()
                          setIsPlayingAudio(false)
                          window.jarvisAPI?.voiceInterrupt?.()
                        }}
                      >
                        <Square className="mr-1.5 h-3 w-3 fill-red-400" />
                        Stop Playback
                      </Button>
                    )}

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isSynthesizing || !playgroundText.trim()}
                      className="h-8 text-xs px-4"
                      onClick={handlePlaygroundSynthesize}
                    >
                      {isSynthesizing ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                          <span>Synthesize & Play</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 5. COLLAPSIBLE ADVANCED SPEECH & HARDWARE CONFIG */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsAdvancedVoiceOpen(!isAdvancedVoiceOpen)}
                  className="w-full flex items-center justify-between p-4 hover:bg-jarvis-hover/50 transition text-left"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-jarvis-accent" />
                    <div>
                      <h3 className="text-xs font-semibold text-jarvis-ivory">Advanced Speech & Audio Hardware</h3>
                      <p className="text-3xs text-jarvis-muted">
                        Configure STT models, Silero VAD sensitivity, barge-in muting, and fallback engines.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-3xs font-mono">
                      {isAdvancedVoiceOpen ? 'Expanded' : 'Configure'}
                    </Badge>
                    {isAdvancedVoiceOpen ? (
                      <ChevronUp className="h-4 w-4 text-jarvis-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-jarvis-muted" />
                    )}
                  </div>
                </button>

                {isAdvancedVoiceOpen && (
                  <div className="p-4 pt-0 space-y-4 border-t border-jarvis-border/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      {/* STT Engine */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-jarvis-ivory">Speech-to-Text (STT) Engine</label>
                        <select
                          value={voiceConfig?.sttProvider || 'groq-whisper'}
                          onChange={(e) => {
                            const val = e.target.value
                            setVoiceConfig((prev: any) => ({ ...prev, sttProvider: val }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ sttProvider: val })
                          }}
                          className="w-full rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                        >
                          <option value="groq-whisper">Groq Whisper Cloud (~150ms sub-second latency)</option>
                          <option value="openai-whisper">OpenAI Whisper Cloud API</option>
                        </select>
                        <p className="text-3xs text-jarvis-muted">
                          Groq runs whisper-large-v3-turbo with sub-second turnaround.
                        </p>
                      </div>

                      {/* Primary TTS Engine Override */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-jarvis-ivory">Primary TTS Engine Override</label>
                        <select
                          value={voiceConfig?.ttsProvider || 'openvoice-v2'}
                          onChange={(e) => {
                            const val = e.target.value
                            setVoiceConfig((prev: any) => ({ ...prev, ttsProvider: val }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ ttsProvider: val })
                          }}
                          className="w-full rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                        >
                          <option value="openvoice-v2">OpenVoice V2 (High-Fidelity J.A.R.V.I.S. Clone, CPU Native)</option>
                          <option value="kokoro-82m">Kokoro-82M ONNX (CPU Native, &lt;150ms TTFA)</option>
                          <option value="xtts-v2">Coqui XTTS-v2 (Zero-Shot Cloned Profiles)</option>
                          <option value="system-speech">Windows SAPI (100% Offline, Zero-Download)</option>
                          <option value="edge-tts">Edge TTS (Cloud Streaming)</option>
                          <option value="openai-tts">OpenAI TTS (tts-1)</option>
                        </select>
                        <p className="text-3xs text-jarvis-muted">
                          Sentence chunking ensures audio playback begins while text is streaming.
                        </p>
                      </div>

                      {/* Fallback TTS Engine */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-jarvis-ivory">Fallback TTS Engine</label>
                        <select
                          value={voiceConfig?.ttsFallbackProvider || 'system-speech'}
                          onChange={(e) => {
                            const val = e.target.value
                            setVoiceConfig((prev: any) => ({ ...prev, ttsFallbackProvider: val }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ ttsFallbackProvider: val })
                          }}
                          className="w-full rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                        >
                          <option value="system-speech">Windows SAPI (100% Offline, Zero-Download)</option>
                          <option value="kokoro-82m">Kokoro-82M ONNX</option>
                        </select>
                        <p className="text-3xs text-jarvis-muted">
                          Instant zero-lag fallback when primary model is busy or offline.
                        </p>
                      </div>

                      {/* STT Language */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-jarvis-ivory">Primary Language</label>
                        <select
                          value={voiceConfig?.language || 'en'}
                          onChange={(e) => {
                            const val = e.target.value
                            setVoiceConfig((prev: any) => ({ ...prev, language: val }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ language: val })
                          }}
                          className="w-full rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2 text-xs text-jarvis-ivory focus:border-jarvis-accent focus:outline-none"
                        >
                          <option value="en">English (US/UK)</option>
                          <option value="auto">Auto-detect</option>
                        </select>
                        <p className="text-3xs text-jarvis-muted">
                          Language for transcription and text-to-speech processing.
                        </p>
                      </div>
                    </div>

                    {/* VAD & Barge-in Controls */}
                    <div className="border-t border-jarvis-border/60 pt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-jarvis-ivory">Silero VAD Speech Activity Detection</p>
                          <p className="text-3xs text-jarvis-muted mt-0.5">
                            High-precision neural VAD v5 running in &lt;1ms/frame on CPU.
                          </p>
                        </div>
                        <Switch
                          label="Toggle VAD"
                          checked={voiceConfig?.vadEnabled !== false}
                          onCheckedChange={(checked) => {
                            setVoiceConfig((prev: any) => ({ ...prev, vadEnabled: checked }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ vadEnabled: checked })
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t border-jarvis-border/40 pt-3">
                        <div>
                          <p className="text-xs font-medium text-jarvis-ivory">Instant Barge-in Interruption</p>
                          <p className="text-3xs text-jarvis-muted mt-0.5">
                            Instantly cancels TTS speech and listens the moment you start speaking (&lt;150ms).
                          </p>
                        </div>
                        <Switch
                          label="Toggle Barge-in"
                          checked={voiceConfig?.interruptOnUserSpeech !== false}
                          onCheckedChange={(checked) => {
                            setVoiceConfig((prev: any) => ({ ...prev, interruptOnUserSpeech: checked }))
                            window.jarvisAPI?.voiceUpdateConfig?.({ interruptOnUserSpeech: checked })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Temporary Session Audio Cache */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-jarvis-ivory flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <span>Temporary Session Audio Cache</span>
                    </h3>
                    <p className="text-3xs text-jarvis-muted mt-0.5 leading-relaxed">
                      Synthesized speech files are temporarily saved during this session to serve repeated prompts with zero latency (&lt;5ms). Cache is automatically purged on application exit and startup.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isClearingCache || !cacheStats || cacheStats.entryCount === 0}
                    onClick={() => void handleClearAudioCache()}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    {isClearingCache ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-jarvis-accent" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-jarvis-muted" />
                    )}
                    <span>Clear Session Cache</span>
                  </Button>
                </div>

                <div className="flex items-center gap-3 pt-1 text-2xs font-mono text-jarvis-muted">
                  <span className="flex items-center gap-1">
                    <span className="text-jarvis-ivory font-bold">{cacheStats?.entryCount ?? 0}</span> cached utterances
                  </span>
                  <span className="text-jarvis-border">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-jarvis-ivory font-bold">
                      {cacheStats?.totalBytes ? `${(cacheStats.totalBytes / 1024).toFixed(1)} KB` : '0 KB'}
                    </span> disk usage
                  </span>
                  {cacheStats?.cacheDir && (
                    <>
                      <span className="text-jarvis-border">•</span>
                      <span className="truncate max-w-[260px] text-3xs text-jarvis-muted/70" title={cacheStats.cacheDir}>
                        {cacheStats.cacheDir}
                      </span>
                    </>
                  )}
                </div>
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

              {/* SQLite Database Storage */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-jarvis-accent shrink-0" />
                      <h2 className="text-xs font-semibold text-jarvis-ivory">SQLite Storage Location</h2>
                      {settings?.sqliteStoragePath &&
                      settings?.defaultSqliteStoragePath &&
                      settings.sqliteStoragePath.toLowerCase() !==
                        settings.defaultSqliteStoragePath.toLowerCase() ? (
                        <Badge variant="accent">Custom Folder</Badge>
                      ) : (
                        <Badge variant="neutral">Default</Badge>
                      )}
                    </div>
                    <p className="text-3xs text-jarvis-muted mt-1 leading-relaxed">
                      Choose the folder where <code className="font-mono">jarvis.sqlite</code> (conversations, settings, and task history) is saved. New folders receive a safe copy of your current database; folders with an existing database load it without overwriting.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-jarvis-border bg-jarvis-base px-3 py-2">
                  <span className="font-mono text-2xs text-jarvis-ivory truncate">
                    {settings?.sqliteStoragePath || 'Resolving…'}
                  </span>
                  {settings?.sqliteStoragePath && (
                    <button
                      type="button"
                      onClick={() => window.jarvisAPI?.openPath?.(settings.sqliteStoragePath!, true)}
                      className="inline-flex items-center gap-1 font-mono text-3xs text-jarvis-sage hover:text-jarvis-ivory shrink-0"
                    >
                      <FolderOpen className="h-3 w-3" />
                      Open
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={storageUpdating}
                    onClick={() => void handleChooseSqliteFolder()}
                    className="gap-1.5 text-xs"
                  >
                    {storageUpdating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="h-3.5 w-3.5" />
                    )}
                    {storageUpdating ? 'Updating…' : 'Select Folder…'}
                  </Button>

                  {settings?.sqliteStoragePath &&
                    settings?.defaultSqliteStoragePath &&
                    settings.sqliteStoragePath.toLowerCase() !==
                      settings.defaultSqliteStoragePath.toLowerCase() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={storageUpdating}
                        onClick={() => void applySqliteStorageFolder(null)}
                        className="gap-1.5 text-xs text-jarvis-muted hover:text-jarvis-ivory"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset to Default
                      </Button>
                    )}
                </div>

                {storageFeedback && (
                  <p
                    className={cn(
                      'font-mono text-3xs',
                      storageFeedback.ok ? 'text-jarvis-accent' : 'text-red-400'
                    )}
                  >
                    {storageFeedback.text}
                  </p>
                )}
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
