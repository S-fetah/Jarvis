import { ModelCatalog, ProviderId } from '../../shared/types'
import { ToolDefinition } from '../tools/tool-registry'
import { PromptEngine } from './prompt-engine'
import { CredentialVault } from './credential-vault'
import {
  AnthropicProvider,
  BaseOpenAICompatibleProvider,
  ChatCompletionMessage,
  ChatWithToolsResult,
  DeepSeekProvider,
  GeminiProvider,
  GroqProvider,
  IModelProvider,
  OllamaProvider,
  OpenAIProvider,
  OpenRouterProvider,
  RequestOptions,
  StreamChunk
} from './providers'

export interface TaskModelRouting {
  model: string
  providerId: ProviderId
  category: 'coding' | 'reasoning' | 'fast_chat' | 'general'
  reason: string
}

export class ModelBalancer {
  private vault: CredentialVault
  private providers: Map<ProviderId, IModelProvider> = new Map()
  private cooldowns: Map<string, number> = new Map()

  constructor(vault: CredentialVault) {
    this.vault = vault
    this.initProviders()
  }

  private initProviders(): void {
    // 1. Google Gemini
    this.providers.set(
      'gemini',
      new GeminiProvider(
        () => this.vault.getKey('gemini'),
        () => this.vault.getBaseUrl('gemini')
      )
    )

    // 2. Groq Cloud
    this.providers.set(
      'groq',
      new GroqProvider(
        () => this.vault.getKey('groq'),
        () => this.vault.getBaseUrl('groq')
      )
    )

    // 3. DeepSeek
    this.providers.set(
      'deepseek',
      new DeepSeekProvider(
        () => this.vault.getKey('deepseek'),
        () => this.vault.getBaseUrl('deepseek')
      )
    )

    // 4. OpenAI
    this.providers.set(
      'openai',
      new OpenAIProvider(
        () => this.vault.getKey('openai'),
        () => this.vault.getBaseUrl('openai')
      )
    )

    // 5. Anthropic Claude
    this.providers.set(
      'anthropic',
      new AnthropicProvider(
        () => this.vault.getKey('anthropic'),
        () => this.vault.getBaseUrl('anthropic')
      )
    )

    // 6. OpenRouter
    this.providers.set(
      'openrouter',
      new OpenRouterProvider(
        () => this.vault.getKey('openrouter'),
        () => this.vault.getBaseUrl('openrouter')
      )
    )

    // 7. Local Ollama
    this.providers.set(
      'ollama',
      new OllamaProvider(() => this.vault.getBaseUrl('ollama'))
    )

    // 8. FreeLLMAPI (Legacy)
    this.providers.set(
      'freellmapi',
      new BaseOpenAICompatibleProvider({
        id: 'freellmapi',
        name: 'FreeLLMAPI (Legacy)',
        defaultModel: 'gemini-flash-lite',
        getApiKey: () => this.vault.getKey('freellmapi') || process.env.FREELLMAPI_API_KEY || 'freellmapi',
        getBaseUrl: () => this.vault.getBaseUrl('freellmapi')
      })
    )

    // 9. Custom
    this.providers.set(
      'custom',
      new BaseOpenAICompatibleProvider({
        id: 'custom',
        name: 'Custom Endpoint',
        defaultModel: 'default',
        getApiKey: () => this.vault.getKey('custom'),
        getBaseUrl: () => this.vault.getBaseUrl('custom')
      })
    )
  }

  public getProvider(id: ProviderId): IModelProvider | undefined {
    return this.providers.get(id)
  }

  public isProviderReady(id: ProviderId): boolean {
    if (!this.vault.isEnabled(id)) return false
    if (!this.vault.hasKey(id)) return false

    // Check cooldown
    const cooldownExpiry = this.cooldowns.get(id)
    if (cooldownExpiry && Date.now() < cooldownExpiry) {
      return false
    }
    return true
  }

  public recordCooldown(providerId: string, durationSeconds = 60): void {
    const expiresAt = Date.now() + durationSeconds * 1000
    this.cooldowns.set(providerId, expiresAt)
    console.warn(`[ModelBalancer] Provider '${providerId}' placed on cooldown until ${new Date(expiresAt).toLocaleTimeString()}`)
  }

  public clearCooldown(providerId: string): void {
    this.cooldowns.delete(providerId)
  }

  /**
   * Intelligently selects the best model and provider based on user prompt and active keys.
   */
  public resolveModelForTask(prompt: string, _catalog?: ModelCatalog): TaskModelRouting {
    const isCoding =
      prompt.includes('```') ||
      (prompt.includes('{') && prompt.includes('}')) ||
      /\b(code|script|function|class|import|export|const|let|var|def|return|interface|type|async|await|bug|error|exception|patch|refactor|compile|build|npm|git|bash|powershell|regex|typescript|python|javascript|rust|sql|terminal|test)\b/i.test(
        prompt
      )

    const isReasoning =
      /\b(why|compare|tradeoff|analyze|architect|explain the difference|derive|calculate|math|logic|proof|evaluate|strategy|pros and cons|decide|recommend)\b/i.test(
        prompt
      )

    const isFastChat =
      prompt.trim().length < 40 &&
      /\b(hi|hello|hey|good morning|how are you|who are you|what is your name|thank you|thanks|briefly|what time|status|ping)\b/i.test(
        prompt
      )

    // 1. Coding Tasks
    if (isCoding) {
      if (this.isProviderReady('deepseek')) {
        return { model: 'deepseek-chat', providerId: 'deepseek', category: 'coding', reason: 'DeepSeek native coding engine' }
      }
      if (this.isProviderReady('anthropic')) {
        return { model: 'claude-3-5-sonnet-20241022', providerId: 'anthropic', category: 'coding', reason: 'Claude 3.5 Sonnet frontier coding' }
      }
      if (this.isProviderReady('openai')) {
        return { model: 'gpt-4o', providerId: 'openai', category: 'coding', reason: 'GPT-4o technical execution' }
      }
      if (this.isProviderReady('gemini')) {
        return { model: 'gemini-2.0-flash', providerId: 'gemini', category: 'coding', reason: 'Gemini 2.0 Flash high-speed code generation' }
      }
      if (this.isProviderReady('groq')) {
        return { model: 'llama-3.3-70b-versatile', providerId: 'groq', category: 'coding', reason: 'Groq Llama 3.3 70B' }
      }
    }

    // 2. Analytical Reasoning
    if (isReasoning) {
      if (this.isProviderReady('deepseek')) {
        return { model: 'deepseek-reasoner', providerId: 'deepseek', category: 'reasoning', reason: 'DeepSeek R1 frontier chain-of-thought' }
      }
      if (this.isProviderReady('anthropic')) {
        return { model: 'claude-3-7-sonnet-20250219', providerId: 'anthropic', category: 'reasoning', reason: 'Claude 3.7 hybrid reasoning' }
      }
      if (this.isProviderReady('gemini')) {
        return { model: 'gemini-1.5-pro', providerId: 'gemini', category: 'reasoning', reason: 'Gemini Pro deep analysis' }
      }
      if (this.isProviderReady('openai')) {
        return { model: 'o3-mini', providerId: 'openai', category: 'reasoning', reason: 'OpenAI o3-mini logical reasoning' }
      }
    }

    // 3. Fast Chat
    if (isFastChat) {
      if (this.isProviderReady('groq')) {
        return { model: 'llama-3.1-8b-instant', providerId: 'groq', category: 'fast_chat', reason: 'Groq ultra-low latency response' }
      }
      if (this.isProviderReady('gemini')) {
        return { model: 'gemini-2.0-flash-lite', providerId: 'gemini', category: 'fast_chat', reason: 'Gemini Flash Lite rapid chat' }
      }
      if (this.isProviderReady('openai')) {
        return { model: 'gpt-4o-mini', providerId: 'openai', category: 'fast_chat', reason: 'GPT-4o-mini lightweight response' }
      }
    }

    // 4. Default / General Capability Fallback
    if (this.isProviderReady('gemini')) {
      return { model: 'gemini-2.0-flash', providerId: 'gemini', category: 'general', reason: 'Gemini 2.0 Flash balanced multimodal default' }
    }
    if (this.isProviderReady('groq')) {
      return { model: 'llama-3.3-70b-versatile', providerId: 'groq', category: 'general', reason: 'Groq Llama 3.3 70B' }
    }
    if (this.isProviderReady('deepseek')) {
      return { model: 'deepseek-chat', providerId: 'deepseek', category: 'general', reason: 'DeepSeek V3 general model' }
    }
    if (this.isProviderReady('openai')) {
      return { model: 'gpt-4o', providerId: 'openai', category: 'general', reason: 'OpenAI GPT-4o' }
    }
    if (this.isProviderReady('anthropic')) {
      return { model: 'claude-3-5-sonnet-20241022', providerId: 'anthropic', category: 'general', reason: 'Claude 3.5 Sonnet' }
    }
    if (this.isProviderReady('ollama')) {
      return { model: 'llama3.2', providerId: 'ollama', category: 'general', reason: 'Local Ollama offline model' }
    }

    // Fall back to FreeLLMAPI legacy or custom
    return { model: 'gemini-flash-lite', providerId: 'freellmapi', category: 'general', reason: 'Fallback route' }
  }

  /**
   * Maps a model name to its best provider.
   */
  public resolveProviderForModel(modelName: string): { provider: IModelProvider; model: string; providerId: ProviderId } {
    const lower = (modelName || '').toLowerCase()

    if (lower.startsWith('gemini-') && this.isProviderReady('gemini')) {
      return { provider: this.providers.get('gemini')!, model: modelName, providerId: 'gemini' }
    }
    if ((lower.startsWith('llama-') || lower.startsWith('mixtral-')) && this.isProviderReady('groq')) {
      return { provider: this.providers.get('groq')!, model: modelName, providerId: 'groq' }
    }
    if (lower.startsWith('deepseek-') && this.isProviderReady('deepseek')) {
      return { provider: this.providers.get('deepseek')!, model: modelName, providerId: 'deepseek' }
    }
    if ((lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) && this.isProviderReady('openai')) {
      return { provider: this.providers.get('openai')!, model: modelName, providerId: 'openai' }
    }
    if (lower.startsWith('claude-') && this.isProviderReady('anthropic')) {
      return { provider: this.providers.get('anthropic')!, model: modelName, providerId: 'anthropic' }
    }
    if (this.isProviderReady('openrouter') && (lower.includes('/') || lower.startsWith('anthropic/') || lower.startsWith('meta-llama/'))) {
      return { provider: this.providers.get('openrouter')!, model: modelName, providerId: 'openrouter' }
    }
    if (this.isProviderReady('ollama') && !lower.includes('gemini') && !lower.includes('gpt')) {
      return { provider: this.providers.get('ollama')!, model: modelName, providerId: 'ollama' }
    }

    // Check all ready providers in priority order
    const priorityList: ProviderId[] = ['gemini', 'groq', 'deepseek', 'openai', 'anthropic', 'openrouter', 'ollama', 'custom', 'freellmapi']
    for (const pid of priorityList) {
      if (this.isProviderReady(pid)) {
        const p = this.providers.get(pid)!
        return { provider: p, model: modelName, providerId: pid }
      }
    }

    // Default to freellmapi or custom
    const fallback = this.providers.get('freellmapi') || this.providers.get('gemini')!
    return { provider: fallback, model: modelName, providerId: 'freellmapi' }
  }

  /**
   * Returns fallback queue of { provider, model } candidates for failover.
   */
  public getFailoverQueue(primaryModel: string): Array<{ provider: IModelProvider; model: string; providerId: ProviderId }> {
    const queue: Array<{ provider: IModelProvider; model: string; providerId: ProviderId }> = []
    const primary = this.resolveProviderForModel(primaryModel)
    queue.push(primary)

    const fallbackConfigs: Array<{ providerId: ProviderId; model: string }> = [
      { providerId: 'gemini', model: 'gemini-2.0-flash-lite' },
      { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      { providerId: 'deepseek', model: 'deepseek-chat' },
      { providerId: 'openai', model: 'gpt-4o-mini' },
      { providerId: 'anthropic', model: 'claude-3-5-haiku-20241022' },
      { providerId: 'ollama', model: 'llama3.2' },
      { providerId: 'freellmapi', model: 'gemini-flash-lite' }
    ]

    for (const fb of fallbackConfigs) {
      if (fb.providerId !== primary.providerId && this.isProviderReady(fb.providerId)) {
        const p = this.providers.get(fb.providerId)
        if (p) queue.push({ provider: p, model: fb.model, providerId: fb.providerId })
      }
    }

    return queue
  }

  /**
   * Unified streaming execution with automatic provider failover.
   */
  public async chatStream(
    messages: ChatCompletionMessage[],
    onChunk: (data: StreamChunk) => void,
    options?: RequestOptions
  ): Promise<{ reply: string; reasoning: string }> {
    let targetModel = options?.model
    if (!targetModel || targetModel === 'auto') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const routing = this.resolveModelForTask(lastUser?.content || '')
      targetModel = routing.model
    }

    const systemPrompt: ChatCompletionMessage = {
      role: 'system',
      content: PromptEngine.buildSystemPrompt(options)
    }
    const payload = [systemPrompt, ...messages]

    const queue = this.getFailoverQueue(targetModel)
    let lastError: Error | null = null

    for (let i = 0; i < queue.length; i++) {
      const { provider, model, providerId } = queue[i]
      try {
        return await provider.chatStream(payload, onChunk, { ...options, model })
      } catch (err: any) {
        lastError = err
        const isRateLimit = err?.message?.includes('429') || err?.message?.includes('rate_limit')
        if (isRateLimit) {
          this.recordCooldown(providerId, 75)
          console.warn(`[ModelBalancer] Rate limited on ${provider.name} (${model}), falling back to next provider...`)
        } else {
          console.warn(`[ModelBalancer] Error on ${provider.name} (${model}):`, err.message)
        }
      }
    }

    throw lastError || new Error('All model providers failed or are on cooldown')
  }

  /**
   * Unified tool execution with automatic provider failover.
   */
  public async chatWithTools(
    messages: ChatCompletionMessage[],
    tools?: ToolDefinition[],
    options?: RequestOptions
  ): Promise<ChatWithToolsResult> {
    let targetModel = options?.model
    if (!targetModel || targetModel === 'auto') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const routing = this.resolveModelForTask(lastUser?.content || '')
      targetModel = routing.model
    }

    const systemPrompt: ChatCompletionMessage = {
      role: 'system',
      content: PromptEngine.buildSystemPrompt(options)
    }
    const payload = [systemPrompt, ...messages]

    const queue = this.getFailoverQueue(targetModel)
    let lastError: Error | null = null

    for (let i = 0; i < queue.length; i++) {
      const { provider, model, providerId } = queue[i]
      try {
        const result = await provider.chatWithTools(payload, tools, { ...options, model })
        return {
          ...result,
          activeModel: model,
          isLowQuota: i >= queue.length - 2
        }
      } catch (err: any) {
        lastError = err
        const isRateLimit = err?.message?.includes('429') || err?.message?.includes('rate_limit')
        if (isRateLimit) {
          this.recordCooldown(providerId, 75)
          console.warn(`[ModelBalancer] Rate limited on ${provider.name} (${model}), failing over...`)
        } else {
          console.warn(`[ModelBalancer] Error on ${provider.name} (${model}):`, err.message)
        }
      }
    }

    throw lastError || new Error('All model providers exhausted')
  }

  /**
   * Aggregates all available models across active providers.
   */
  public async listAllModels(): Promise<ModelCatalog> {
    const allModels = new Set<string>(['auto'])
    const lightModels = new Set<string>()

    const readyProviders: ProviderId[] = ['gemini', 'groq', 'deepseek', 'openai', 'anthropic', 'openrouter', 'ollama', 'freellmapi']

    for (const pid of readyProviders) {
      if (this.isProviderReady(pid)) {
        const meta = this.vault.getHubState().providers.find((p) => p.id === pid)
        if (meta?.models) {
          for (const m of meta.models) {
            allModels.add(m)
            if (m.includes('lite') || m.includes('mini') || m.includes('8b') || m.includes('haiku')) {
              lightModels.add(m)
            }
          }
        }
      }
    }

    if (allModels.size <= 1) {
      // Default baseline catalog
      return {
        all: ['auto', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'llama-3.3-70b-versatile', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'deepseek-chat'],
        light: ['gemini-2.0-flash-lite', 'llama-3.1-8b-instant', 'gpt-4o-mini', 'claude-3-5-haiku-20241022']
      }
    }

    return {
      all: Array.from(allModels),
      light: Array.from(lightModels)
    }
  }
}
