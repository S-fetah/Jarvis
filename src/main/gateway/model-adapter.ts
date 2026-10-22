import fs from 'fs'
import path from 'path'
import initSqlJs from 'sql.js'
import { PlanStep, ModelCatalog } from '../../shared/types'

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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
   * Fetches available models from the gateway and categorizes them into light and standard models.
   */
  public async listModels(): Promise<ModelCatalog> {
    const fallbackCatalog: ModelCatalog = {
      all: [
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
    options?: { model?: string; isLightMode?: boolean }
  ): Promise<{ reply: string; reasoning: string }> {
    const apiKey = await this.getEffectiveApiKey()
    const chosenModel = options?.isLightMode
      ? this.config.lightModel || 'gemini-flash-lite'
      : options?.model || this.config.model

    const systemPrompt: ChatCompletionMessage = {
      role: 'system',
      content:
        'You are Jarvis, an intelligent, assistive desktop AI assistant for Windows. ' +
        'Always enclose your internal reasoning, step-by-step thinking, and execution plan within <think>...</think> tags. ' +
        'After </think>, deliver your clean, helpful, concise response in GitHub-flavored markdown.'
    }

    const payloadMessages = [systemPrompt, ...messages]

    let fullReply = ''
    let fullReasoning = ''
    let insideThinkTag = false

    const sendRequest = async (attempt = 1): Promise<Response> => {
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
          model: chosenModel,
          messages: payloadMessages,
          stream: true,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(45000)
      })

      // ADR-003: Retry on transient 502/503/504
      if ([502, 503, 504].includes(res.status) && attempt <= 2) {
        console.warn(`[ModelGatewayAdapter] Received ${res.status}, retrying (attempt ${attempt})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        return sendRequest(attempt + 1)
      }

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Gateway returned HTTP ${res.status}: ${errorText}`)
      }

      return res
    }

    const response = await sendRequest()
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
        directResponse:
          'I am Jarvis, an open-source, local-first Windows AI desktop assistant. I help you inspect codebases, synthesize PDF research documents, and execute approved development tasks using strict assistive autonomy (ADR-004).'
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
    if (trimmed.includes('git') || trimmed.includes('status') || trimmed.includes('branch')) {
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

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
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
