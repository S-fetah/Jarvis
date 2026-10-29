import fs from 'fs'
import path from 'path'
import { safeStorage } from 'electron'
import { ProviderConfig, ProviderHubState, ProviderId } from '../../shared/types'

interface StoredProviderRecord {
  encryptedKey?: string
  enabled: boolean
  baseUrl?: string
}

interface StoredVaultData {
  providers: Record<string, StoredProviderRecord>
  localServerEnabled: boolean
  localServerPort: number
  activeProviderId: ProviderId | 'auto'
}

export const PROVIDER_METADATA: Record<
  ProviderId,
  {
    name: string
    description: string
    websiteUrl: string
    getKeyUrl: string
    defaultBaseUrl?: string
    defaultModels: string[]
    isLocal?: boolean
  }
> = {
  gemini: {
    name: 'Google Gemini',
    description: 'High-speed multimodality and generous free tier via Google AI Studio',
    websiteUrl: 'https://ai.google.dev',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro']
  },
  groq: {
    name: 'Groq Cloud',
    description: 'Ultra-fast LPU inference (300+ tok/s) with free tier Llama 3.3',
    websiteUrl: 'https://groq.com',
    getKeyUrl: 'https://console.groq.com/keys',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'deepseek-r1-distill-llama-70b'
    ]
  },
  deepseek: {
    name: 'DeepSeek Platform',
    description: 'Inexpensive coding powerhouse (V3) and frontier math reasoning (R1)',
    websiteUrl: 'https://deepseek.com',
    getKeyUrl: 'https://platform.deepseek.com/api_keys',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  openai: {
    name: 'OpenAI Platform',
    description: 'Industry standard reasoning, instruction following, and tool calling',
    websiteUrl: 'https://openai.com',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini']
  },
  anthropic: {
    name: 'Anthropic Claude',
    description: 'Frontier code generation, refactoring, and step-by-step thinking',
    websiteUrl: 'https://anthropic.com',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  },
  openrouter: {
    name: 'OpenRouter.ai',
    description: 'Single API key giving access to 100+ models with competitive pricing',
    websiteUrl: 'https://openrouter.ai',
    getKeyUrl: 'https://openrouter.ai/keys',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct']
  },
  ollama: {
    name: 'Local Ollama',
    description: '100% private, local offline execution on your own GPU/CPU without internet',
    websiteUrl: 'https://ollama.com',
    getKeyUrl: 'https://ollama.com',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1:8b'],
    isLocal: true
  },
  freellmapi: {
    name: 'FreeLLMAPI (Legacy)',
    description: 'Local FreeLLMAPI proxy process running on port 31415',
    websiteUrl: 'http://127.0.0.1:31415',
    getKeyUrl: 'http://127.0.0.1:31415',
    defaultBaseUrl: 'http://127.0.0.1:31415/v1',
    defaultModels: ['auto', 'gemini-flash-lite', 'gemini-3.6-flash'],
    isLocal: true
  },
  custom: {
    name: 'Custom OpenAI Endpoint',
    description: 'Any self-hosted proxy, LM Studio, vLLM, or custom OpenAI-compatible server',
    websiteUrl: '',
    getKeyUrl: '',
    defaultBaseUrl: '',
    defaultModels: []
  }
}

export class CredentialVault {
  private filePath: string
  private data: StoredVaultData
  private decryptedMemoryCache: Map<ProviderId, string> = new Map()

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'provider_vault.json')
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): StoredVaultData {
    const defaultData: StoredVaultData = {
      providers: {
        gemini: { enabled: true, baseUrl: PROVIDER_METADATA.gemini.defaultBaseUrl },
        groq: { enabled: true, baseUrl: PROVIDER_METADATA.groq.defaultBaseUrl },
        deepseek: { enabled: true, baseUrl: PROVIDER_METADATA.deepseek.defaultBaseUrl },
        openai: { enabled: true, baseUrl: PROVIDER_METADATA.openai.defaultBaseUrl },
        anthropic: { enabled: true, baseUrl: PROVIDER_METADATA.anthropic.defaultBaseUrl },
        openrouter: { enabled: false, baseUrl: PROVIDER_METADATA.openrouter.defaultBaseUrl },
        ollama: { enabled: true, baseUrl: PROVIDER_METADATA.ollama.defaultBaseUrl },
        freellmapi: { enabled: true, baseUrl: PROVIDER_METADATA.freellmapi.defaultBaseUrl },
        custom: { enabled: false, baseUrl: '' }
      },
      localServerEnabled: false,
      localServerPort: 31415,
      activeProviderId: 'auto'
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8')
        const parsed = JSON.parse(raw) as Partial<StoredVaultData>
        return {
          providers: { ...defaultData.providers, ...(parsed.providers || {}) },
          localServerEnabled: parsed.localServerEnabled ?? defaultData.localServerEnabled,
          localServerPort: parsed.localServerPort ?? defaultData.localServerPort,
          activeProviderId: parsed.activeProviderId ?? defaultData.activeProviderId
        }
      }
    } catch (err) {
      console.warn('[CredentialVault] Failed to read vault file, initializing defaults:', err)
    }

    return defaultData
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
    } catch (err) {
      console.error('[CredentialVault] Failed to save vault to disk:', err)
    }
  }

  private encrypt(plaintext: string): string {
    if (!plaintext) return ''
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(plaintext).toString('base64')
      }
    } catch {}
    // Headless / non-DPAPI fallback (e.g. test environment)
    return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`
  }

  private decrypt(ciphertext: string): string {
    if (!ciphertext) return ''
    if (ciphertext.startsWith('enc:')) {
      return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8')
    }
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(ciphertext, 'base64')
        return safeStorage.decryptString(buf)
      }
    } catch (err) {
      console.warn('[CredentialVault] safeStorage decrypt failed, attempting raw decode:', err)
    }
    try {
      return Buffer.from(ciphertext, 'base64').toString('utf8')
    } catch {
      return ciphertext
    }
  }

  public setKey(id: ProviderId, apiKey: string, baseUrl?: string): void {
    const trimmed = (apiKey || '').trim()
    const target = this.data.providers[id] || { enabled: true }

    if (trimmed) {
      target.encryptedKey = this.encrypt(trimmed)
      target.enabled = true
      this.decryptedMemoryCache.set(id, trimmed)
    } else {
      delete target.encryptedKey
      this.decryptedMemoryCache.delete(id)
    }

    if (baseUrl !== undefined) {
      target.baseUrl = baseUrl.trim()
    }

    this.data.providers[id] = target
    this.saveToDisk()
  }

  public getKey(id: ProviderId): string | null {
    if (this.decryptedMemoryCache.has(id)) {
      return this.decryptedMemoryCache.get(id) || null
    }

    const rec = this.data.providers[id]
    if (!rec?.encryptedKey) return null

    const decrypted = this.decrypt(rec.encryptedKey)
    if (decrypted) {
      this.decryptedMemoryCache.set(id, decrypted)
      return decrypted
    }
    return null
  }

  public getBaseUrl(id: ProviderId): string {
    const rec = this.data.providers[id]
    if (rec?.baseUrl && rec.baseUrl.trim()) {
      return rec.baseUrl.trim()
    }
    return PROVIDER_METADATA[id]?.defaultBaseUrl || ''
  }

  public setBaseUrl(id: ProviderId, baseUrl: string): void {
    const target = this.data.providers[id] || { enabled: true }
    target.baseUrl = baseUrl.trim()
    this.data.providers[id] = target
    this.saveToDisk()
  }

  public hasKey(id: ProviderId): boolean {
    if (id === 'ollama') return true // Ollama is local, doesn't require cloud API key
    if (id === 'freellmapi') return true // FreeLLMAPI can authenticate via default or local DB
    const rec = this.data.providers[id]
    return Boolean(rec?.encryptedKey && rec.encryptedKey.length > 0)
  }

  public getPreview(id: ProviderId): string | undefined {
    const key = this.getKey(id)
    if (!key) return undefined
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}••••${key.slice(-4)}`
  }

  public setEnabled(id: ProviderId, enabled: boolean): void {
    const target = this.data.providers[id] || { enabled: true }
    target.enabled = enabled
    this.data.providers[id] = target
    this.saveToDisk()
  }

  public isEnabled(id: ProviderId): boolean {
    const rec = this.data.providers[id]
    return rec ? rec.enabled : true
  }

  public getHubState(): ProviderHubState {
    const providerList: ProviderConfig[] = (Object.keys(PROVIDER_METADATA) as ProviderId[]).map((id) => {
      const meta = PROVIDER_METADATA[id]
      const hasKey = this.hasKey(id)
      const enabled = this.isEnabled(id)
      const baseUrl = this.getBaseUrl(id)

      let status: ProviderConfig['status'] = 'unconfigured'
      if (meta.isLocal) {
        status = enabled ? 'online' : 'offline'
      } else if (hasKey && enabled) {
        status = 'online'
      } else if (!enabled) {
        status = 'offline'
      }

      return {
        id,
        name: meta.name,
        description: meta.description,
        websiteUrl: meta.websiteUrl,
        getKeyUrl: meta.getKeyUrl,
        hasKey,
        previewKey: this.getPreview(id),
        enabled,
        baseUrl,
        status,
        models: meta.defaultModels,
        isLocal: meta.isLocal
      }
    })

    return {
      providers: providerList,
      activeProviderId: this.data.activeProviderId,
      localServerEnabled: this.data.localServerEnabled,
      localServerPort: this.data.localServerPort,
      localServerRunning: false // Will be set by LocalGatewayServer instance
    }
  }

  public updateHubSettings(updates: {
    activeProviderId?: ProviderId | 'auto'
    localServerEnabled?: boolean
    localServerPort?: number
  }): void {
    if (updates.activeProviderId !== undefined) {
      this.data.activeProviderId = updates.activeProviderId
    }
    if (updates.localServerEnabled !== undefined) {
      this.data.localServerEnabled = updates.localServerEnabled
    }
    if (updates.localServerPort !== undefined) {
      this.data.localServerPort = updates.localServerPort
    }
    this.saveToDisk()
  }
}
