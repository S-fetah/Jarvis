import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import initSqlJs from 'sql.js'
import { safeStorage } from 'electron'
import { ProviderConfig, ProviderHubState, ProviderId } from '@jarvis/protocol'

interface StoredProviderRecord {
  encryptedKey?: string
  enabled: boolean
  baseUrl?: string
}

interface StoredVaultData {
  providers: Record<string, StoredProviderRecord>
  localServerEnabled: boolean
  localServerPort: number
  localServerToken?: string
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
  nvidia: {
    name: 'NVIDIA NIM',
    description: 'Frontier AI models hosted on NVIDIA DGX Cloud with free trial inference credits',
    websiteUrl: 'https://build.nvidia.com',
    getKeyUrl: 'https://build.nvidia.com',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModels: ['meta/llama-3.3-70b-instruct', 'nvidia/nemotron-3-super-120b-a12b', 'deepseek-ai/deepseek-r1']
  },
  mistral: {
    name: 'Mistral AI',
    description: 'European frontier models, Codestral code generation, and Mistral Large',
    websiteUrl: 'https://mistral.ai',
    getKeyUrl: 'https://console.mistral.ai/api-keys',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['codestral-latest', 'mistral-small-latest', 'mistral-large-latest']
  },
  cohere: {
    name: 'Cohere Platform',
    description: 'Enterprise search, multilingual reasoning, Command R, and Aya series with free trial keys',
    websiteUrl: 'https://cohere.com',
    getKeyUrl: 'https://dashboard.cohere.com/api-keys',
    defaultBaseUrl: 'https://api.cohere.com/v2',
    defaultModels: ['command-r-08-2024', 'command-r-plus-08-2024', 'command-a-03-2025']
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    description: 'Serverless global edge inference with daily free neuron allocation',
    websiteUrl: 'https://ai.cloudflare.com',
    getKeyUrl: 'https://dash.cloudflare.com',
    defaultBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    defaultModels: ['@cf/meta/llama-3.3-70b-instruct', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', '@cf/qwen/qwen3-30b-a3b-fp8']
  },
  cerebras: {
    name: 'Cerebras Cloud',
    description: 'Wafer-scale engine with lightning-fast inference (2000+ tok/s) and free tier',
    websiteUrl: 'https://cerebras.ai',
    getKeyUrl: 'https://cloud.cerebras.ai',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModels: ['llama3.3-70b', 'llama3.1-8b']
  },
  pollinations: {
    name: 'Pollinations.ai',
    description: '100% free, community-driven keyless endpoint for text and chat models',
    websiteUrl: 'https://pollinations.ai',
    getKeyUrl: '',
    defaultBaseUrl: 'https://gen.pollinations.ai/v1',
    defaultModels: ['openai', 'mistral', 'llama'],
    isLocal: false
  },
  ovh: {
    name: 'OVHcloud AI Endpoints',
    description: 'Free European cloud AI endpoints with keyless anonymous tier',
    websiteUrl: 'https://endpoints.ai.cloud.ovh.net',
    getKeyUrl: '',
    defaultBaseUrl: 'https://endpoints.ai.cloud.ovh.net/v1',
    defaultModels: ['Meta-Llama-3_3-70B-Instruct', 'gpt-oss-120b'],
    isLocal: false
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
  private vaultKey: Buffer
  private decryptedMemoryCache: Map<ProviderId, string> = new Map()

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'provider_vault.json')
    this.vaultKey = this.resolveVaultKey(userDataDir)
    this.data = this.loadFromDisk()

    // Auto-migrate from FreeLLMAPI on first load or if keys cannot be decrypted
    if (this.hasFreeLLMAPIDatabase() && !this.getKey('groq') && !this.getKey('gemini')) {
      void this.importFromFreeLLMAPI()
    }
  }

  private resolveVaultKey(userDataDir: string): Buffer {
    const keyPath = path.join(userDataDir, '.vault-key')
    try {
      if (fs.existsSync(keyPath)) {
        const hex = fs.readFileSync(keyPath, 'utf8').trim()
        if (hex.length === 64) {
          return Buffer.from(hex, 'hex')
        }
      }
      const newKey = crypto.randomBytes(32)
      fs.mkdirSync(userDataDir, { recursive: true })
      fs.writeFileSync(keyPath, newKey.toString('hex'), 'utf8')
      return newKey
    } catch {
      return crypto
        .createHash('sha256')
        .update(userDataDir + (process.env.COMPUTERNAME || 'JARVIS'))
        .digest()
    }
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
        nvidia: { enabled: true, baseUrl: PROVIDER_METADATA.nvidia.defaultBaseUrl },
        mistral: { enabled: true, baseUrl: PROVIDER_METADATA.mistral.defaultBaseUrl },
        cohere: { enabled: true, baseUrl: PROVIDER_METADATA.cohere.defaultBaseUrl },
        cloudflare: { enabled: true, baseUrl: PROVIDER_METADATA.cloudflare.defaultBaseUrl },
        cerebras: { enabled: true, baseUrl: PROVIDER_METADATA.cerebras.defaultBaseUrl },
        pollinations: { enabled: true, baseUrl: PROVIDER_METADATA.pollinations.defaultBaseUrl },
        ovh: { enabled: true, baseUrl: PROVIDER_METADATA.ovh.defaultBaseUrl },
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
          localServerToken: parsed.localServerToken,
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
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', this.vaultKey, iv)
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      return `v1:aes-256-gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
    } catch (err) {
      console.error('[CredentialVault] AES-256-GCM encryption failed:', err)
      return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`
    }
  }

  private decrypt(ciphertext: string): string {
    if (!ciphertext) return ''

    // 1. Permanent machine-bound AES-256-GCM vault format
    if (ciphertext.startsWith('v1:aes-256-gcm:')) {
      try {
        const parts = ciphertext.split(':')
        if (parts.length === 5) {
          const iv = Buffer.from(parts[2], 'hex')
          const tag = Buffer.from(parts[3], 'hex')
          const enc = Buffer.from(parts[4], 'hex')
          const decipher = crypto.createDecipheriv('aes-256-gcm', this.vaultKey, iv)
          decipher.setAuthTag(tag)
          const decrypted = decipher.update(enc, undefined, 'utf8') + decipher.final('utf8')
          return decrypted
        }
      } catch (err) {
        console.warn('[CredentialVault] AES-256-GCM decrypt error:', err)
        return ''
      }
    }

    // 2. Headless plain base64 fallback
    if (ciphertext.startsWith('enc:')) {
      try {
        return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8')
      } catch {
        return ''
      }
    }

    // 3. Legacy safeStorage fallback
    try {
      if (
        safeStorage &&
        typeof safeStorage.isEncryptionAvailable === 'function' &&
        safeStorage.isEncryptionAvailable()
      ) {
        const buf = Buffer.from(ciphertext, 'base64')
        const decrypted = safeStorage.decryptString(buf)
        // Verify decrypted string does not contain replacement characters or non-ASCII control characters
        if (decrypted && !decrypted.includes('\uFFFD')) {
          return decrypted
        }
      }
    } catch {
      // SafeStorage failed
    }

    // Never return raw binary ciphertext or corrupt replacement characters (\uFFFD)
    return ''
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
    if (id === 'ollama' || id === 'pollinations' || id === 'ovh') return true // Local or keyless free providers
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
      localServerRunning: false, // Will be set by LocalGatewayServer instance
      localServerToken: this.getLocalServerToken(),
      hasFreeLLMAPI: this.hasFreeLLMAPIDatabase()
    }
  }

  /**
   * Bearer token for the local gateway server (ADR-007: no unauthenticated endpoint).
   * Generated once and persisted; the vault file is protected by the Windows user profile.
   */
  public getLocalServerToken(): string {
    if (!this.data.localServerToken) {
      this.data.localServerToken = `jarvis-${crypto.randomBytes(24).toString('hex')}`
      this.saveToDisk()
    }
    return this.data.localServerToken
  }

  public hasFreeLLMAPIDatabase(): boolean {
    const appData = process.env.APPDATA || ''
    const encKeyFile = path.join(appData, 'FreeLLMAPI', '.encryption-key')
    const dbFile = path.join(appData, 'FreeLLMAPI', 'freeapi.db')
    return fs.existsSync(encKeyFile) && fs.existsSync(dbFile)
  }

  public async importFromFreeLLMAPI(): Promise<{ success: boolean; imported: string[]; error?: string }> {
    try {
      const appData = process.env.APPDATA || ''
      const freeApiDir = path.join(appData, 'FreeLLMAPI')
      const encKeyFile = path.join(freeApiDir, '.encryption-key')
      const dbFile = path.join(freeApiDir, 'freeapi.db')

      if (!fs.existsSync(encKeyFile) || !fs.existsSync(dbFile)) {
        return { success: false, imported: [], error: 'No FreeLLMAPI database found on this computer.' }
      }

      const encKeyHex = fs.readFileSync(encKeyFile, 'utf8').trim()
      const encKey = Buffer.from(encKeyHex, 'hex')

      const SQL = await initSqlJs()
      const dbBuffer = fs.readFileSync(dbFile)
      const db = new SQL.Database(dbBuffer)

      const res = db.exec('SELECT id, platform, encrypted_key, iv, auth_tag, enabled, base_url FROM api_keys')
      if (!res || !res.length) {
        return { success: false, imported: [], error: 'No API keys found in FreeLLMAPI.' }
      }

      const rows = res[0].values
      const imported: string[] = []

      const platformMap: Record<string, ProviderId> = {
        google: 'gemini',
        groq: 'groq',
        openrouter: 'openrouter',
        nvidia: 'nvidia',
        mistral: 'mistral',
        cohere: 'cohere',
        cloudflare: 'cloudflare',
        cerebras: 'cerebras',
        deepseek: 'deepseek',
        openai: 'openai',
        anthropic: 'anthropic'
      }

      for (const row of rows) {
        const [, platform, enc, iv, tag, , baseUrl] = row as [number, string, string, string, string, number, string?]
        const targetId = platformMap[platform.toLowerCase()]
        if (!targetId) continue

        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'hex'))
          decipher.setAuthTag(Buffer.from(tag, 'hex'))
          const decryptedKey = decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8')

          if (decryptedKey && decryptedKey.trim()) {
            this.setKey(targetId, decryptedKey.trim(), baseUrl || undefined)
            imported.push(targetId)
          }
        } catch (e: any) {
          console.warn(`[CredentialVault] Decryption failed for ${platform}:`, e.message)
        }
      }

      return { success: imported.length > 0, imported }
    } catch (err: any) {
      return { success: false, imported: [], error: err.message }
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
