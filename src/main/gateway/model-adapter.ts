import { PlanStep } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelGatewayConfig {
  baseUrl: string
  apiKey?: string
  model: string
}

export class ModelGatewayAdapter {
  private config: ModelGatewayConfig

  constructor(config: ModelGatewayConfig) {
    this.config = config
  }

  public updateConfig(config: Partial<ModelGatewayConfig>): void {
    Object.assign(this.config, config)
  }

  /**
   * Generates a context-aware task plan based on the user's explicit goal.
   * If an LLM gateway is configured and reachable, it uses it.
   * Otherwise, it generates an intelligent, deterministic plan matching the instruction.
   */
  public async generatePlanForGoal(goal: string, workspacePath: string): Promise<{ steps: PlanStep[]; directResponse?: string }> {
    const trimmed = goal.trim().toLowerCase()

    // 1. Conversational / Identity Queries (No dangerous execution!)
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
          "I am Jarvis, an open-source, local-first Windows AI desktop assistant. I help you inspect codebases, synthesize PDF research documents, and execute approved development tasks using strict assistive autonomy (ADR-004)."
      }
    }

    // 2. Try querying the LLM Gateway if an API key is available
    if (this.config.apiKey) {
      try {
        const plan = await this.queryLlmPlan(goal, workspacePath)
        if (plan && plan.length > 0) {
          return { steps: plan }
        }
      } catch (err) {
        console.warn('[ModelGateway] LLM call failed, falling back to local planner:', err)
      }
    }

    // 3. Contextual Pattern Matching for Specific Goals (Never run dev server unless requested!)
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
      // Default general safe inspection
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

  private async queryLlmPlan(goal: string, workspacePath: string): Promise<PlanStep[] | null> {
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
        Authorization: `Bearer ${this.config.apiKey}`
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
