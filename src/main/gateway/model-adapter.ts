import fs from 'fs'
import path from 'path'
import initSqlJs from 'sql.js'
import { PlanStep, ModelCatalog, TalkingStyle, TaskMode, ThinkingDepth } from '../../shared/types'
import { ToolDefinition } from '../tools/tool-registry'
import { PromptEngine } from './prompt-engine'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ChatWithToolsResult {
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: ToolCall[]
  }
  finishReason?: string
}

export interface ModelGatewayConfig {
  baseUrl: string
  apiKey?: string
  model: string
  lightModel?: string
}

export interface StreamChunk {
  type: 'thought' | 'content'
  chunk: string
}

export interface TaskModelRouting {
  model: string
  category: 'coding' | 'reasoning' | 'fast_chat' | 'general'
  reason: string
}

export class ModelGatewayAdapter {
  private config: ModelGatewayConfig
  private cachedApiKey: string | null = null

  constructor(config: ModelGatewayConfig) {
    this.config = {
      lightModel: 'gemini-flash-lite',
      ...config
    }
  }

  public updateConfig(config: Partial<ModelGatewayConfig>): void {
    Object.assign(this.config, config)
    if (config.apiKey) {
      this.cachedApiKey = config.apiKey
    }
  }

  /**
   * Resolves the effective API key in priority order:
   * 1. Explicitly configured apiKey (e.g. from UI settings)
   * 2. process.env.FREELLMAPI_API_KEY
   * 3. Local FreeLLMAPI unified_api_key from %APPDATA%/FreeLLMAPI/freeapi.db
   */
  public async getEffectiveApiKey(): Promise<string | null> {
    if (this.config.apiKey && this.config.apiKey.trim()) {
      return this.config.apiKey.trim()
    }

    if (process.env.FREELLMAPI_API_KEY && process.env.FREELLMAPI_API_KEY.trim()) {
      return process.env.FREELLMAPI_API_KEY.trim()
    }

    if (this.cachedApiKey) {
      return this.cachedApiKey
    }

    // Try reading FreeLLMAPI unified_api_key locally on Windows
    try {
      const appData = process.env.APPDATA
      if (appData) {
        const dbPath = path.join(appData, 'FreeLLMAPI', 'freeapi.db')
        if (fs.existsSync(dbPath)) {
          const SQL = await initSqlJs()
          const fileBuffer = fs.readFileSync(dbPath)
          const db = new SQL.Database(fileBuffer)
          const res = db.exec("SELECT value FROM settings WHERE key='unified_api_key'")
          const key = res[0]?.values?.[0]?.[0] as string | undefined
          db.close()
          if (key && key.trim()) {
            this.cachedApiKey = key.trim()
            return this.cachedApiKey
          }
        }
      }
    } catch (err) {
      console.warn('[ModelGatewayAdapter] Could not auto-detect FreeLLMAPI key:', err)
    }

    return null
  }

  /**
   * Intelligently classifies the user prompt and selects the best model from the available catalog.
   */
  public resolveModelForTask(prompt: string, catalog?: ModelCatalog): TaskModelRouting {
    const allModels =
      catalog?.all && catalog.all.length > 0
        ? catalog.all.filter((m) => m !== 'auto')
        : [
            'gemini-3.6-flash',
            'gemini-flash-lite',
            'gemini-3.7-flash',
            'gpt-4o',
            'gpt-4o-mini',
            'claude-haiku-4-5',
            'deepseek-v4-flash-thinking'
          ]

    const findBestAvailable = (preferences: string[], fallback: string): string => {
      for (const pref of preferences) {
        const found = allModels.find((m) => m.toLowerCase().includes(pref.toLowerCase()))
        if (found) return found
      }
      return allModels.includes(fallback) ? fallback : allModels[0] || fallback
    }

    // 1. Coding & Technical Tasks
    const isCoding =
      prompt.includes('```') ||
      (prompt.includes('{') && prompt.includes('}')) ||
      /\b(code|script|function|class|import|export|const|let|var|def|return|interface|type|async|await|bug|error|exception|patch|refactor|compile|build|npm|git|bash|powershell|regex|typescript|python|javascript|rust|sql|terminal|test)\b/i.test(
        prompt
      )

    if (isCoding) {
      const best = findBestAvailable(
        [
          'deepseek-v4-flash-thinking',
          'deepseek-coder',
          'qwen',
          'claude-3-5',
          'claude-3-7',
          'gemini-3.7-flash',
          'gpt-4o',
          'gemini-3.6-flash'
        ],
        'gemini-3.6-flash'
      )
      return {
        model: best,
        category: 'coding',
        reason: 'Technical code analysis, syntax parsing, or file modification'
      }
    }

    // 2. Deep Analytical Reasoning & Complex Logic
    const isReasoning =
      /\b(why|compare|tradeoff|analyze|architect|explain the difference|derive|calculate|math|logic|proof|evaluate|strategy|pros and cons|decide|recommend)\b/i.test(
        prompt
      )

    if (isReasoning) {
      const best = findBestAvailable(
        [
          'deepseek-v4-flash-thinking',
          'deepseek-r1',
          'gemini-3.7-flash',
          'o1',
          'o3',
          'gpt-4o',
          'claude',
          'gemini-3.6-flash'
        ],
        'gemini-3.6-flash'
      )
      return {
        model: best,
        category: 'reasoning',
        reason: 'Multi-step analytical reasoning and architectural logic'
      }
    }

    // 3. Fast Conversational Chat, Greetings & Simple Lookups
    const isFastChat =
      prompt.trim().length < 80 &&
      /\b(hi|hello|hey|good morning|how are you|who are you|what is your name|thank you|thanks|briefly|what time|status|ping)\b/i.test(
        prompt
      )

    if (isFastChat) {
      const best = findBestAvailable(
        [
          'gemini-flash-lite',
          'gemini-3.5-flash-lite',
          'gemini-2.5-flash-lite',
          'gpt-4o-mini',
          'claude-haiku',
          'llama-3.1-8b',
          'gemini-3.6-flash'
        ],
        'gemini-flash-lite'
      )
      return {
        model: best,
        category: 'fast_chat',
        reason: 'Low-latency conversational query'
      }
    }

    // 4. General / Web Research / Document & PDF Generation
    const best = findBestAvailable(
      ['gemini-3.6-flash', 'gpt-4o', 'gemini-3.7-flash', 'llama-3.3-70b'],
      'gemini-3.6-flash'
    )
    return {
      model: best,
      category: 'general',
      reason: 'General balanced capability for web, documents, or planning'
    }
  }

  /**
   * Fetches available models from the gateway and categorizes them into light and standard models.
   */
  public async listModels(): Promise<ModelCatalog> {
    const fallbackCatalog: ModelCatalog = {
      all: [
        'auto',
        'gemini-3.6-flash',
        'gemini-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-3.7-flash',
        'gpt-4o',
        'gpt-4o-mini',
        'claude-haiku-4-5',
        'deepseek-v4-flash-thinking'
      ],
      light: [
        'gemini-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash-lite',
        'gpt-4o-mini',
        'claude-haiku-4-5'
      ]
    }

    try {
      const apiKey = await this.getEffectiveApiKey()
      const headers: Record<string, string> = {}
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers,
        signal: AbortSignal.timeout(6000)
      })

      if (!res.ok) {
        console.warn(`[ModelGatewayAdapter] /models returned ${res.status}`)
        return fallbackCatalog
      }

      const json = await res.json()
      const modelList = Array.isArray(json?.data) ? json.data.map((m: any) => m.id as string) : []

      if (modelList.length === 0) {
        return fallbackCatalog
      }

      if (!modelList.includes('auto')) {
        modelList.unshift('auto')
      }

      // Prioritize light models
      const lightKeywords = ['flash-lite', 'lite', 'mini', 'haiku']
      const lightModels = modelList.filter((id) => {
        const lower = id.toLowerCase()
        return lightKeywords.some((kw) => lower.includes(kw))
      })

      return {
        all: modelList,
        light: lightModels.length > 0 ? lightModels : fallbackCatalog.light
      }
    } catch (err) {
      console.warn('[ModelGatewayAdapter] Failed to list models:', err)
      return fallbackCatalog
    }
  }

  /**
   * Streams a chat completion response, parsing both reasoning/thinking tokens
   * and final response content.
   */
  public async chatStream(
    messages: ChatCompletionMessage[],
    onChunk: (data: StreamChunk) => void,
    options?: {
      model?: string
      isLightMode?: boolean
      talkingStyle?: TalkingStyle
      taskMode?: TaskMode
      thinkingDepth?: ThinkingDepth
    }
  ): Promise<{ reply: string; reasoning: string }> {
    const apiKey = await this.getEffectiveApiKey()
    let chosenModel = options?.isLightMode
      ? this.config.lightModel || 'gemini-flash-lite'
      : options?.model || this.config.model

    if (!chosenModel || chosenModel === 'auto') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const routing = this.resolveModelForTask(lastUser?.content || '')
      chosenModel = routing.model
    }

    const systemPrompt: ChatCompletionMessage = {
      role: 'system',
      content: PromptEngine.buildSystemPrompt(options)
    }

    const payloadMessages = [systemPrompt, ...messages]

    let fullReply = ''
    let fullReasoning = ''
    let insideThinkTag = false

    const sendRequest = async (modelToUse: string, attempt = 1): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelToUse,
          messages: payloadMessages,
          stream: true,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(45000)
      })

      // Transient 502/503/504 retry
      if ([502, 503, 504].includes(res.status) && attempt <= 2) {
        console.warn(`[ModelGatewayAdapter] Received ${res.status}, retrying (attempt ${attempt})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        return sendRequest(modelToUse, attempt + 1)
      }

      // Handle 429 Rate Limit: Try fallback to light model if not already using it
      if (res.status === 429 && modelToUse !== 'gemini-flash-lite' && attempt === 1) {
        console.warn(
          `[ModelGatewayAdapter] Model ${modelToUse} rate limited (429), attempting fallback to gemini-flash-lite...`
        )
        return sendRequest('gemini-flash-lite', 2)
      }

      if (!res.ok) {
        const errorText = await res.text()
        let retrySeconds = 75
        try {
          const parsed = JSON.parse(errorText)
          const match = parsed?.error?.message?.match(/reset ~(\d+)s/)
          if (match) {
            retrySeconds = parseInt(match[1], 10)
          } else if (parsed?.error?.retryAtMs) {
            retrySeconds = Math.max(5, Math.round((parsed.error.retryAtMs - Date.now()) / 1000))
          }
        } catch {}

        if (res.status === 429) {
          throw new Error(
            JSON.stringify({
              isRateLimit: true,
              retrySeconds,
              model: modelToUse
            })
          )
        }

        throw new Error(`Gateway returned HTTP ${res.status}: ${errorText}`)
      }

      return res
    }

    const response = await sendRequest(chosenModel)
    if (!response.body) {
      throw new Error('Response body is empty')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          // 1. Check for native reasoning_content (e.g. DeepSeek R1 / OpenAI o-series)
          if (delta.reasoning_content) {
            fullReasoning += delta.reasoning_content
            onChunk({ type: 'thought', chunk: delta.reasoning_content })
          }

          // 2. Check for content and handle <think> tags
          if (delta.content) {
            let contentText = delta.content as string

            while (contentText.length > 0) {
              if (!insideThinkTag) {
                const thinkStart = contentText.indexOf('<think>')
                if (thinkStart !== -1) {
                  // Text before <think> is normal content
                  if (thinkStart > 0) {
                    const before = contentText.slice(0, thinkStart)
                    fullReply += before
                    onChunk({ type: 'content', chunk: before })
                  }
                  insideThinkTag = true
                  contentText = contentText.slice(thinkStart + 7)
                } else {
                  fullReply += contentText
                  onChunk({ type: 'content', chunk: contentText })
                  contentText = ''
                }
              } else {
                const thinkEnd = contentText.indexOf('</think>')
                if (thinkEnd !== -1) {
                  const thought = contentText.slice(0, thinkEnd)
                  fullReasoning += thought
                  onChunk({ type: 'thought', chunk: thought })
                  insideThinkTag = false
                  contentText = contentText.slice(thinkEnd + 8)
                } else {
                  fullReasoning += contentText
                  onChunk({ type: 'thought', chunk: contentText })
                  contentText = ''
                }
              }
            }
          }
        } catch {
          // Ignore partial JSON chunks
        }
      }
    }

    return {
      reply: fullReply.trim(),
      reasoning: fullReasoning.trim()
    }
  }

  /**
   * Performs a chat completion step with OpenAI-compatible function calling (tools) enabled.
   */
  public async chatWithTools(
    messages: ChatCompletionMessage[],
    tools?: ToolDefinition[],
    options?: {
      model?: string
      isLightMode?: boolean
      talkingStyle?: TalkingStyle
      taskMode?: TaskMode
      thinkingDepth?: ThinkingDepth
    }
  ): Promise<ChatWithToolsResult> {
    const apiKey = await this.getEffectiveApiKey()
    let chosenModel = options?.isLightMode
      ? this.config.lightModel || 'gemini-flash-lite'
      : options?.model || this.config.model

    if (!chosenModel || chosenModel === 'auto') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const routing = this.resolveModelForTask(lastUser?.content || '')
      chosenModel = routing.model
    }

    const systemPrompt: ChatCompletionMessage = {
      role: 'system',
      content: PromptEngine.buildSystemPrompt(options)
    }

    const payloadMessages = [systemPrompt, ...messages]

    const sendRequest = async (modelToUse: string, attempt = 1): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const bodyPayload: Record<string, unknown> = {
        model: modelToUse,
        messages: payloadMessages,
        temperature: 0.2
      }

      if (tools && tools.length > 0) {
        bodyPayload.tools = tools
        bodyPayload.tool_choice = 'auto'
      }

      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(35000)
      })

      // Transient 502/503/504 retry
      if ([502, 503, 504].includes(res.status) && attempt <= 2) {
        console.warn(`[ModelGatewayAdapter] chatWithTools received ${res.status}, retrying (attempt ${attempt})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        return sendRequest(modelToUse, attempt + 1)
      }

      // Handle 429 Rate Limit: Try fallback to light model
      if (res.status === 429 && modelToUse !== 'gemini-flash-lite' && attempt === 1) {
        console.warn(`[ModelGatewayAdapter] chatWithTools rate limited (429), falling back to gemini-flash-lite...`)
        return sendRequest('gemini-flash-lite', 2)
      }

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Gateway returned HTTP ${res.status}: ${errorText}`)
      }

      return res
    }

    const res = await sendRequest(chosenModel)
    const json = await res.json()
    const choice = json.choices?.[0]
    if (!choice || !choice.message) {
      throw new Error('Invalid response structure from model gateway: no choices returned.')
    }

    return {
      message: {
        role: 'assistant',
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls
      },
      finishReason: choice.finish_reason
    }
  }

  /**
   * Generates a context-aware task plan based on the user's explicit goal.
   */
  public async generatePlanForGoal(
    goal: string,
    workspacePath: string
  ): Promise<{ steps: PlanStep[]; directResponse?: string }> {
    const trimmed = goal.trim().toLowerCase()

    // Conversational queries
    if (
      trimmed === 'who are u ?' ||
      trimmed === 'who are u' ||
      trimmed === 'who are you' ||
      trimmed === 'who are you?' ||
      trimmed === 'what are you' ||
      trimmed === 'what can you do' ||
      trimmed === 'help' ||
      trimmed === 'hi' ||
      trimmed === 'hello'
    ) {
      return {
        steps: [
          {
            id: 'step-identity',
            title: 'Identify Jarvis Assistant',
            description: 'Answer identity and capabilities query directly.',
            category: 'read_in',
            status: 'completed'
          }
        ],
        directResponse: PromptEngine.getIdentityResponse()
      }
    }

    // Try querying LLM for intelligent step breakdown
    const apiKey = await this.getEffectiveApiKey()
    if (apiKey) {
      try {
        const plan = await this.queryLlmPlan(goal, workspacePath, apiKey)
        if (plan && plan.length > 0) {
          return { steps: plan }
        }
      } catch (err) {
        console.warn('[ModelGateway] LLM plan query failed, falling back to local planner:', err)
      }
    }

    // Contextual Pattern Matching
    const steps: PlanStep[] = []
    if (
      trimmed.includes('gmail') ||
      trimmed.includes('chrome') ||
      trimmed.includes('mail.google.com') ||
      (trimmed.includes('browser') && (trimmed.includes('open') || trimmed.includes('launch')))
    ) {
      steps.push({
        id: 'step-browser-launch',
        title: 'Launch Google Chrome with Gmail',
        description: 'Launch Google Chrome browser navigating to https://mail.google.com (Requires approval).',
        category: 'process',
        status: 'pending'
      })
    } else if (trimmed.includes('git') || trimmed.includes('status') || trimmed.includes('branch')) {
      steps.push({
        id: 'step-git',
        title: 'Check Git Status',
        description: 'Read repository git status and recent commit log.',
        category: 'read_in',
        status: 'pending'
      })
    } else if (trimmed.includes('pdf') || trimmed.includes('doc') || trimmed.includes('summary')) {
      steps.push(
        {
          id: 'step-read',
          title: 'Inspect Workspace Files',
          description: 'Read project structure and documentation to synthesize.',
          category: 'read_in',
          status: 'pending'
        },
        {
          id: 'step-pdf',
          title: 'Generate Summary PDF Document',
          description: 'Create a clean, formatted PDF report in the output folder.',
          category: 'write_in',
          status: 'pending'
        }
      )
    } else if (trimmed.includes('dev') || trimmed.includes('server') || trimmed.includes('start')) {
      steps.push(
        {
          id: 'step-inspect',
          title: 'Inspect package.json Scripts',
          description: 'Read scripts and dependency manifest to find startup command.',
          category: 'read_in',
          status: 'pending'
        },
        {
          id: 'step-dev',
          title: 'Start Development Server',
          description: 'Launch the project dev server (Requires user approval).',
          category: 'process',
          status: 'pending'
        }
      )
    } else {
      steps.push(
        {
          id: 'step-inspect',
          title: 'Inspect Workspace',
          description: `Analyze project structure under ${workspacePath}.`,
          category: 'read_in',
          status: 'pending'
        },
        {
          id: 'step-report',
          title: 'Summarize Findings',
          description: 'Report workspace status and available scripts.',
          category: 'read_in',
          status: 'pending'
        }
      )
    }

    return { steps }
  }

  private async queryLlmPlan(
    goal: string,
    workspacePath: string,
    apiKey: string
  ): Promise<PlanStep[] | null> {
    const prompt = `You are Jarvis, a desktop AI assistant. The user wants to: "${goal}".
The current workspace is "${workspacePath}".
Break this down into 1 to 4 ordered steps using these permission categories:
- read_in: reading inside workspace (e.g. read files, inspect package.json)
- write_in: writing new files inside workspace (e.g. create pdf or report)
- process: running commands or starting servers (requires user approval)
- network: browsing web documentation

Output ONLY a JSON array with this structure:
[
  { "id": "step-1", "title": "Step Title", "description": "Brief step description", "category": "read_in" }
]`

    const planModel =
      !this.config.model || this.config.model === 'auto'
        ? this.resolveModelForTask(goal).model
        : this.config.model

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: planModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (!res.ok) return null

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return parsed.map((s: any, idx: number) => ({
        id: s.id || `step-${idx + 1}`,
        title: s.title || `Step ${idx + 1}`,
        description: s.description || '',
        category: s.category || 'read_in',
        status: 'pending'
      }))
    }
    return null
  }
}
