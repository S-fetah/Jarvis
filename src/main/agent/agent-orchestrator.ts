import crypto from 'crypto'
import path from 'path'
import { ModelGatewayAdapter, ChatCompletionMessage } from '../gateway/model-adapter'
import { ToolExecutor, ToolExecutionResult } from '../tools/tool-executor'
import { JARVIS_TOOLS } from '../tools/tool-registry'
import { TimelineEvent, TalkingStyle, TaskMode, ThinkingDepth } from '../../shared/types'

export interface AgentOrchestratorConfig {
  maxTurns?: number
  defaultWorkspacePath: string
  defaultOutputDir?: string
}

export interface AgentRunOptions {
  conversationId?: string
  workspacePath?: string
  outputDirectory?: string
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
    const outputDirectory =
      options?.outputDirectory || this.config.defaultOutputDir || path.join(workspacePath, 'output')
    const maxTurns = this.config.maxTurns || 5
    const toolsUsed: AgentRunResult['toolsUsed'] = []
    const conversationMessages: ChatCompletionMessage[] = [...messages]
    const taskId = options?.taskId || crypto.randomUUID()

    let turn = 0
    let finalReply = ''
    let reasoning = ''

    options?.onStatusUpdate?.('thinking', 'Analyzing request...')

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const userPrompt = lastUserMsg?.content || ''
    const isAutoModel = !options?.model || options.model === 'auto'
    let effectiveModel = options?.model

    if (isAutoModel && typeof this.modelAdapter.resolveModelForTask === 'function') {
      const routing = this.modelAdapter.resolveModelForTask(userPrompt)
      effectiveModel = routing.model
      if (options?.onTimelineEvent) {
        options.onTimelineEvent({
          id: crypto.randomUUID(),
          taskId,
          timestamp: Date.now(),
          type: 'log',
          title: `Smart Auto-Routing → ${routing.model}`,
          details: `Classified as ${routing.category.replace('_', ' ')}: ${routing.reason}.`,
          category: 'read_in'
        })
      }
    }

    while (turn < maxTurns) {
      turn++

      // 1. Ask model with registered tools
      let response
      try {
        response = await this.modelAdapter.chatWithTools(
          conversationMessages,
          JARVIS_TOOLS,
          {
            model: effectiveModel,
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

      // 2. If no tool calls were requested, check for false refusal or synthesize final answer
      if (!toolCalls || toolCalls.length === 0) {
        // Intelligent Action Verification Guard (Turn 1):
        // If the model produced a refusal claiming inability for a supported capability,
        // intervene and prompt the model to re-verify against its active tool suite.
        if (turn === 1 && this.detectInconsistentRefusal(assistantMessage.content, conversationMessages)) {
          const lastUserMsg = [...conversationMessages].reverse().find((m) => m.role === 'user')
          const userContent = lastUserMsg?.content || ''
          const isQuestion =
            userContent.trim().endsWith('?') ||
            userContent.toLowerCase().startsWith('can you') ||
            userContent.toLowerCase().startsWith('can u') ||
            userContent.toLowerCase().startsWith('are you able') ||
            userContent.toLowerCase().startsWith('could you')

          if (options?.onTimelineEvent) {
            options.onTimelineEvent({
              id: crypto.randomUUID(),
              taskId,
              timestamp: Date.now(),
              type: 'tool_call',
              title: 'Action Verification Layer',
              details: isQuestion
                ? 'Intent Verification: Re-evaluating capability inquiry against tool catalog.'
                : 'Self-Correction: Model re-evaluating request against active tool catalog.',
              category: 'process'
            })
          }
          conversationMessages.push({
            role: 'assistant',
            content: assistantMessage.content
          })
          conversationMessages.push({
            role: 'user',
            content: isQuestion
              ? '[Action Verification Protocol]: You stated that you cannot perform this desktop action, browse/scroll pages, send emails, or reopen tabs. However, you possess active live tools in your catalog (including `browser_list_tabs`, `browser_inspect_page`, `browser_click_element`, `browser_close_tab`, `browser_scroll`, `manage_user_memory`, `send_email_direct` for verified direct delivery, `send_gmail` which can compose and send with tab cleanup, `browser_shortcut` which can reopen tabs and send emails, `list_chrome_profiles`, `open_browser`). Since the user asked a QUESTION about your capabilities, answer affirmatively in plain text that YES you can perform these actions, explain the steps, and offer to proceed upon their instruction. Do NOT execute tools prematurely for a question.'
              : '[Action Verification Protocol]: You stated that you cannot perform this desktop action. However, you possess active tools in your catalog (including `browser_list_tabs`, `browser_inspect_page`, `browser_click_element`, `browser_close_tab`, `browser_scroll`, `manage_user_memory`, `send_email_direct`, `send_gmail`, `browser_shortcut`, `list_chrome_profiles`, `open_browser`, `start_dev_server`, `workspace_list`, `file_patch`, `create_pdf`). Re-read the user request, verify against your tools, check for needed parameters (remember: if a Chrome profile was not explicitly specified by the user, ask which profile to use or check with list_chrome_profiles), and invoke the appropriate tool.'
          })
          continue
        }

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
          const category =
            toolName === 'web_search' || toolName === 'download_file'
              ? 'network'
              : toolName === 'create_pdf' || toolName === 'file_write_new'
                ? 'write_in'
                : 'read_in'

          options.onTimelineEvent({
            id: crypto.randomUUID(),
            taskId,
            timestamp: Date.now(),
            type: 'tool_call',
            title: `Tool: ${toolName}`,
            details: `Args: ${JSON.stringify(parsedArgs)}`,
            category
          })
        }

        const execResult: ToolExecutionResult = await this.toolExecutor.executeTool(
          toolName,
          parsedArgs,
          workspacePath,
          outputDirectory
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

  /**
   * Action Verification Layer: Detects whether an assistant response claims an inability
   * to perform desktop actions (e.g. opening Chrome, dev servers) despite possessing active tools.
   */
  private detectInconsistentRefusal(
    assistantReply: string | null | undefined,
    conversationMessages: ChatCompletionMessage[]
  ): boolean {
    if (!assistantReply) return false
    const text = assistantReply.toLowerCase()

    // If the assistant answered affirmatively ("yes, i can", "i can definitely", "i am able to", "i can send", "i have the capability to"), it's NOT a refusal!
    if (
      text.includes('yes, i can') ||
      text.includes('yes, i am able') ||
      text.includes('i can definitely') ||
      text.includes('i have the capability') ||
      text.includes('i can certainly')
    ) {
      return false
    }

    const hasRefusalSignal =
      text.includes("i can't open") ||
      text.includes("i cannot open") ||
      text.includes("unable to open") ||
      text.includes("i don't have the ability to open") ||
      text.includes("i cannot launch") ||
      text.includes("i can't launch") ||
      text.includes("unable to launch") ||
      text.includes("cannot browse") ||
      text.includes("cannot send") ||
      text.includes("can't send") ||
      text.includes("cannot reopen") ||
      text.includes("can't reopen") ||
      text.includes("as an ai, i cannot") ||
      text.includes("as an ai model, i cannot") ||
      text.includes("i am not able to open") ||
      text.includes("i am unable to directly open")

    if (!hasRefusalSignal) return false

    // Identify user's action request from messages
    const lastUserMsg = [...conversationMessages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg || !lastUserMsg.content) return false

    const userText = lastUserMsg.content.toLowerCase()
    const isActionRequest =
      userText.includes('open') ||
      userText.includes('launch') ||
      userText.includes('start') ||
      userText.includes('browser') ||
      userText.includes('chrome') ||
      userText.includes('dev server') ||
      userText.includes('run') ||
      userText.includes('gmail') ||
      userText.includes('email') ||
      userText.includes('tab') ||
      userText.includes('github')

    return isActionRequest
  }
}
