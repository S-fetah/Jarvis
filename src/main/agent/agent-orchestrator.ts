import crypto from 'crypto'
import { ModelGatewayAdapter, ChatCompletionMessage, ToolCall } from '../gateway/model-adapter'
import { ToolExecutor, ToolExecutionResult } from '../tools/tool-executor'
import { JARVIS_TOOLS } from '../tools/tool-registry'
import { TimelineEvent, TalkingStyle, TaskMode, ThinkingDepth } from '../../shared/types'

export interface AgentOrchestratorConfig {
  maxTurns?: number
  defaultWorkspacePath: string
}

export interface AgentRunOptions {
  conversationId?: string
  workspacePath?: string
  model?: string
  isLightMode?: boolean
  talkingStyle?: TalkingStyle
  taskMode?: TaskMode
  thinkingDepth?: ThinkingDepth
  taskId?: string
  onStatusUpdate?: (status: 'thinking' | 'working' | 'synthesizing' | 'completed' | 'error', detail?: string) => void
  onTimelineEvent?: (event: TimelineEvent) => void
  onChunk?: (chunk: { type: 'content' | 'thought'; chunk: string }) => void
}

export interface AgentRunResult {
  reply: string
  reasoning?: string
  toolsUsed: Array<{
    toolName: string
    args: Record<string, unknown>
    success: boolean
    output: string
  }>
  turnsCount: number
}

export class AgentOrchestrator {
  private modelAdapter: ModelGatewayAdapter
  private toolExecutor: ToolExecutor
  private config: AgentOrchestratorConfig

  constructor(
    modelAdapter: ModelGatewayAdapter,
    toolExecutor: ToolExecutor,
    config: AgentOrchestratorConfig
  ) {
    this.modelAdapter = modelAdapter
    this.toolExecutor = toolExecutor
    this.config = {
      maxTurns: 5,
      ...config
    }
  }

  /**
   * Runs the multi-turn agent loop:
   * Goal/Prompt -> Model reasoning -> Tool execution -> Feedback loop -> Final synthesis
   */
  public async runLoop(
    messages: ChatCompletionMessage[],
    options?: AgentRunOptions
  ): Promise<AgentRunResult> {
    const workspacePath = options?.workspacePath || this.config.defaultWorkspacePath
    const maxTurns = this.config.maxTurns || 5
    const toolsUsed: AgentRunResult['toolsUsed'] = []
    const conversationMessages: ChatCompletionMessage[] = [...messages]
    const taskId = options?.taskId || crypto.randomUUID()

    let turn = 0
    let finalReply = ''
    let reasoning = ''

    options?.onStatusUpdate?.('thinking', 'Analyzing request...')

    while (turn < maxTurns) {
      turn++

      // 1. Ask model with registered tools
      let response
      try {
        response = await this.modelAdapter.chatWithTools(
          conversationMessages,
          JARVIS_TOOLS,
          {
            model: options?.model,
            isLightMode: options?.isLightMode,
            talkingStyle: options?.talkingStyle,
            taskMode: options?.taskMode,
            thinkingDepth: options?.thinkingDepth
          }
        )
      } catch (err: any) {
        console.error(`[AgentOrchestrator] Turn ${turn} model gateway error:`, err)
        options?.onStatusUpdate?.('error', err.message)
        throw err
      }

      const assistantMessage = response.message
      const toolCalls = assistantMessage.tool_calls

      // 2. If no tool calls were requested, the model produced the final answer
      if (!toolCalls || toolCalls.length === 0) {
        finalReply = assistantMessage.content || 'I completed the inspection.'
        options?.onStatusUpdate?.('completed', 'Done.')
        break
      }

      // 3. Model requested one or more tool calls
      options?.onStatusUpdate?.('working', `Executing ${toolCalls.length} tool(s)...`)

      // Add assistant message containing the tool calls to conversation context
      conversationMessages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: toolCalls
      })

      // 4. Execute each tool in sequence
      for (const call of toolCalls) {
        const toolName = call.function.name
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = JSON.parse(call.function.arguments || '{}')
        } catch {
          parsedArgs = {}
        }

        // Notify timeline event for start of tool call
        if (options?.onTimelineEvent) {
          options.onTimelineEvent({
            id: crypto.randomUUID(),
            taskId,
            timestamp: Date.now(),
            type: 'tool_call',
            title: `Tool: ${toolName}`,
            details: `Args: ${JSON.stringify(parsedArgs)}`,
            category: toolName === 'web_search' ? 'network' : 'read_in'
          })
        }

        const execResult: ToolExecutionResult = await this.toolExecutor.executeTool(
          toolName,
          parsedArgs,
          workspacePath
        )

        toolsUsed.push({
          toolName,
          args: parsedArgs,
          success: execResult.success,
          output: execResult.output || execResult.error || ''
        })

        // Notify timeline event for completed tool call
        if (options?.onTimelineEvent) {
          options.onTimelineEvent({
            id: crypto.randomUUID(),
            taskId,
            timestamp: Date.now(),
            type: 'log',
            title: `${toolName} Output`,
            details: execResult.success
              ? (execResult.output.length > 200 ? execResult.output.slice(0, 200) + '...' : execResult.output)
              : `Error: ${execResult.error}`
          })
        }

        // Append tool result into context for next model turn
        conversationMessages.push({
          role: 'tool',
          name: toolName,
          tool_call_id: call.id,
          content: execResult.success
            ? execResult.output
            : `Tool failed: ${execResult.error}`
        })
      }

      // If we've reached maxTurns - 1, remind model to synthesize
      if (turn === maxTurns - 1) {
        conversationMessages.push({
          role: 'user',
          content:
            'Please synthesize your final answer now based on the tool outputs gathered above. Cite relevant files, lines, and findings.'
        })
      }
    }

    // If max turns reached without a stop finishReason, do one final synthesis pass
    if (!finalReply) {
      options?.onStatusUpdate?.('synthesizing', 'Synthesizing final findings...')
      try {
        const finalPass = await this.modelAdapter.chatWithTools(
          conversationMessages,
          undefined, // no tools allowed in final pass to force direct reply
          {
            model: options?.model,
            isLightMode: options?.isLightMode,
            talkingStyle: options?.talkingStyle,
            taskMode: options?.taskMode,
            thinkingDepth: options?.thinkingDepth
          }
        )
        finalReply = finalPass.message.content || 'Synthesis completed.'
      } catch (err: any) {
        finalReply = `Inspection completed with ${toolsUsed.length} tool call(s).`
      }
    }

    return {
      reply: finalReply,
      reasoning,
      toolsUsed,
      turnsCount: turn
    }
  }
}
