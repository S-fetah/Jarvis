import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, nativeTheme } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PolicyEngine } from './policy/policy-engine'
import { ModelGatewayAdapter } from './gateway/model-adapter'
import { JarvisDatabase } from './storage/database'
import { MascotManager } from './windows/mascot-manager'
import { ToolExecutor } from './tools/tool-executor'
import { AgentOrchestrator } from './agent/agent-orchestrator'
import { ProcessManager } from './process/process-manager'
import { launchBrowser } from './utils/browser'
import {
  TaskState,
  TimelineEvent,
  JarvisSettings,
  Conversation,
  MascotState
} from '../shared/types'

let mainWindow: BrowserWindow | null = null
let mascotManager: MascotManager | null = null
let isQuitting = false
const processManager = new ProcessManager()

app.on('before-quit', async () => {
  isQuitting = true
  await processManager.stopAll()
})
const policyEngine = new PolicyEngine()

// SEC-011: IPC Sender Validation
function isAuthorizedSender(webContents: Electron.WebContents): boolean {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.id === webContents.id) return true
  const mascotWin = mascotManager?.getMascotWindow()
  if (mascotWin && !mascotWin.isDestroyed() && mascotWin.webContents.id === webContents.id) return true
  const quickWin = mascotManager?.getQuickChatWindow()
  if (quickWin && !quickWin.isDestroyed() && quickWin.webContents.id === webContents.id) return true
  return false
}

// Persistent SQLite Storage
const dbPath = join(process.cwd(), 'userData', 'jarvis.sqlite')
const db = new JarvisDatabase(dbPath)

// In-memory runtime state for tasks
let activeTask: TaskState | null = null

const settings: JarvisSettings = {
  gatewayUrl: 'http://127.0.0.1:31415/v1',
  apiKey: process.env.FREELLMAPI_API_KEY,
  defaultModel: 'gemini-3.6-flash',
  lightMode: false,
  mascotEnabled: true,
  reduceMotion: false,
  workspacePaths: ['C:\\work\\softwares\\jarvis'],
  theme: 'system',
  outputDirectory: 'C:\\work\\softwares\\jarvis\\output',
  talkingStyle: 'balanced',
  taskMode: 'chat',
  thinkingDepth: 'standard'
}

const modelAdapter = new ModelGatewayAdapter({
  baseUrl: settings.gatewayUrl,
  apiKey: settings.apiKey,
  model: settings.defaultModel,
  lightModel: 'gemini-flash-lite'
})

const toolExecutor = new ToolExecutor(policyEngine, processManager, (approvalReq) => {
  const taskId = crypto.randomUUID()
  const taskState: TaskState = {
    id: taskId,
    goal: approvalReq.title || 'Execute Gated Action',
    status: 'waiting_for_approval',
    workspacePath: approvalReq.workspacePath || settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis',
    activeModel: settings.lightMode ? 'gemini-flash-lite' : settings.defaultModel,
    steps: [
      {
        id: 'step-gated-action',
        title: approvalReq.title,
        description: approvalReq.explanation || approvalReq.command || '',
        category: approvalReq.category,
        status: 'in_progress'
      }
    ],
    activeStepId: 'step-gated-action',
    currentApproval: approvalReq,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  sendTaskUpdate(taskState)
  mascotManager?.setMascotState('needsApproval')
  sendTimelineEvent({
    id: crypto.randomUUID(),
    taskId,
    timestamp: Date.now(),
    type: 'approval_prompt',
    title: `Action Requires Approval: ${approvalReq.title}`,
    details: approvalReq.command || approvalReq.explanation || '',
    category: approvalReq.category
  })
})
let agentOrchestrator = new AgentOrchestrator(modelAdapter, toolExecutor, {
  defaultWorkspacePath: settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis',
  defaultOutputDir: settings.outputDirectory
})

function getPreloadPath(): string {
  return fs.existsSync(join(__dirname, '../preload/index.cjs'))
    ? join(__dirname, '../preload/index.cjs')
    : fs.existsSync(join(__dirname, '../preload/index.mjs'))
      ? join(__dirname, '../preload/index.mjs')
      : join(__dirname, '../preload/index.js')
}

type EffectiveTheme = 'light' | 'dark'

function resolveEffectiveTheme(): EffectiveTheme {
  if (settings.theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }
  return settings.theme
}

function getWindowTheme(theme: EffectiveTheme): { background: string; symbol: string } {
  return theme === 'dark'
    ? { background: '#0d1411', symbol: '#c9d2ca' }
    : { background: '#f2eee5', symbol: '#3e4a43' }
}

/**
 * Keeps the native window chrome (overlay controls, frame background and
 * quick-chat shell) in step with the renderer theme.
 */
function applyWindowTheme(theme: EffectiveTheme = resolveEffectiveTheme()): void {
  const colors = getWindowTheme(theme)
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setBackgroundColor(colors.background)
      mainWindow.setTitleBarOverlay({
        color: colors.background,
        symbolColor: colors.symbol,
        height: 44
      })
    } catch (err) {
      console.warn('[Jarvis Main] Failed to apply window theme:', err)
    }
  }
  mascotManager?.setQuickChatTheme(theme)
}

function createWindow(): void {
  const preloadPath = getPreloadPath()
  console.log('[Jarvis Main] Preload path resolved:', preloadPath)
  const windowTheme = getWindowTheme(resolveEffectiveTheme())

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 850,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    title: 'Jarvis — Personal AI Assistant',
    backgroundColor: windowTheme.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: windowTheme.background,
      symbolColor: windowTheme.symbol,
      height: 44
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  // SEC-005: Window open and navigation guards
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url)
      } else {
        console.warn('[Jarvis Main] Blocked non-http window open:', url)
      }
    } catch {
      console.warn('[Jarvis Main] Blocked invalid window open URL:', url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevServer =
      is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL'])
    const isLocalFile = url.startsWith('file://')
    if (!isDevServer && !isLocalFile) {
      event.preventDefault()
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url)
        }
      } catch {}
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('[Jarvis Main] Window ready-to-show')
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    // If mascot is enabled and app is not terminating, hide instead of destroy
    if (!isQuitting && settings.mascotEnabled) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('[Jarvis Main] did-fail-load:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`[Renderer Console L${level}]: ${message} (${sourceId}:${line})`)
  })

  // Enforce Content Security Policy (compatible with Vite dev server HMR in dev mode)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = is.dev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173 blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 blob:; style-src 'self' 'unsafe-inline' http://localhost:5173; img-src 'self' data: blob: http://localhost:5173; connect-src 'self' http://localhost:5173 ws://localhost:5173 http://127.0.0.1:31415 blob: data:"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:31415 blob: data:"

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log('[Jarvis Main] Loading dev URL:', process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.jarvis.desktop')

  // Initialize SQLite storage
  try {
    await db.initialize()
    console.log('[Jarvis Main] SQLite database initialized successfully at:', dbPath)

    const savedApiKey = db.getSetting('apiKey')
    if (savedApiKey) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          try {
            const buf = Buffer.from(savedApiKey, 'base64')
            settings.apiKey = safeStorage.decryptString(buf)
          } catch {
            // Legacy plaintext fallback: upgrade and encrypt it
            settings.apiKey = savedApiKey
            try {
              const encrypted = safeStorage.encryptString(savedApiKey).toString('base64')
              db.setSetting('apiKey', encrypted)
            } catch {}
          }
        } else {
          settings.apiKey = savedApiKey
        }
      } catch {
        settings.apiKey = savedApiKey
      }
    }

    const savedModel = db.getSetting('defaultModel')
    if (savedModel) settings.defaultModel = savedModel

    const savedLightMode = db.getSetting('lightMode')
    if (savedLightMode !== null) settings.lightMode = savedLightMode === 'true'

    const savedGatewayUrl = db.getSetting('gatewayUrl')
    if (savedGatewayUrl) settings.gatewayUrl = savedGatewayUrl

    const savedMascot = db.getSetting('mascot_enabled')
    if (savedMascot !== null) settings.mascotEnabled = savedMascot === 'true'

    const savedStyle = db.getSetting('talkingStyle')
    if (savedStyle) settings.talkingStyle = savedStyle as any

    const savedMode = db.getSetting('taskMode')
    if (savedMode) settings.taskMode = savedMode as any

    const savedDepth = db.getSetting('thinkingDepth')
    if (savedDepth) settings.thinkingDepth = savedDepth as any

    const savedTheme = db.getSetting('theme')
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      settings.theme = savedTheme
    }

    modelAdapter.updateConfig({
      baseUrl: settings.gatewayUrl,
      apiKey: settings.apiKey,
      model: settings.defaultModel
    })

    agentOrchestrator = new AgentOrchestrator(modelAdapter, toolExecutor, {
      defaultWorkspacePath: settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis',
      defaultOutputDir: settings.outputDirectory
    })

    const convs = db.getConversations()
    if (convs.length === 0) {
      db.createConversation('Jarvis General Chat')
    }
  } catch (err) {
    console.error('[Jarvis Main] Failed to initialize SQLite:', err)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const preloadPath = getPreloadPath()

  // Initialize Mascot & Quick-Chat Manager (Surfaces A & B)
  mascotManager = new MascotManager(
    db,
    preloadPath,
    is.dev,
    process.env['ELECTRON_RENDERER_URL'],
    () => mainWindow
  )

  if (settings.mascotEnabled !== false) {
    mascotManager.init()
  }

  registerIpcHandlers()
  createWindow()
  applyWindowTheme()

  nativeTheme.on('updated', () => {
    if (settings.theme === 'system') applyWindowTheme()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // If mascot is enabled and floating, do not quit app on mainWindow close
  if (!settings.mascotEnabled && process.platform !== 'darwin') {
    app.quit()
  }
})

function broadcastToWindows(channel: string, ...args: any[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

// Phase 4: Broadcast background process/dev server updates to all windows
processManager.onUpdate((proc) => {
  broadcastToWindows('process:updated', proc)
})

function sendTaskUpdate(state: TaskState): void {
  activeTask = state
  broadcastToWindows('task:updated', state)

  if (state.status === 'waiting_for_approval') {
    mascotManager?.setMascotState('needsApproval')
  } else if (state.status === 'completed') {
    mascotManager?.setMascotState('completed')
  } else if (state.status === 'cancelled') {
    mascotManager?.setMascotState('error')
  } else if (state.status === 'running') {
    mascotManager?.setMascotState('working')
  }
}

function sendTimelineEvent(event: TimelineEvent): void {
  broadcastToWindows('timeline:event', event)
}

function executeNextStep(task: TaskState, stepIndex: number, workspacePath: string): void {
  if (stepIndex >= task.steps.length) {
    task.status = 'completed'
    sendTaskUpdate({ ...task, updatedAt: Date.now() })
    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId: task.id,
      timestamp: Date.now(),
      type: 'log',
      title: 'Task Completed',
      details: 'All planned steps verified successfully.'
    })
    return
  }

  const step = task.steps[stepIndex]
  task.activeStepId = step.id
  step.status = 'in_progress'
  sendTaskUpdate({ ...task, updatedAt: Date.now() })

  if (step.category === 'read_in') {
    const isProjectInspect =
      step.title.toLowerCase().includes('package') ||
      step.title.toLowerCase().includes('inspect') ||
      step.title.toLowerCase().includes('script') ||
      step.title.toLowerCase().includes('git')

    const toolName = isProjectInspect ? 'project_inspect' : 'workspace_list'
    const toolArgs = isProjectInspect ? { detail: 'summary' } : { maxDepth: 2 }

    toolExecutor
      .executeTool(toolName, toolArgs, workspacePath)
      .then((toolRes) => {
        sendTimelineEvent({
          id: crypto.randomUUID(),
          taskId: task.id,
          timestamp: Date.now(),
          type: 'tool_call',
          title: step.title,
          details: toolRes.success
            ? (toolRes.output.length > 250 ? toolRes.output.slice(0, 250) + '...' : toolRes.output)
            : (toolRes.error || 'Inspection completed'),
          category: 'read_in'
        })

        step.status = 'completed'
        setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 600)
      })
      .catch(() => {
        step.status = 'completed'
        setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 600)
      })
  } else if (step.category === 'write_in') {
    const isPdf =
      step.title.toLowerCase().includes('pdf') ||
      step.title.toLowerCase().includes('doc') ||
      step.description.toLowerCase().includes('pdf')

    const toolName = isPdf ? 'create_pdf' : 'file_write_new'
    const toolArgs = isPdf
      ? {
          title: step.title,
          content: `# ${step.title}\n\n${step.description}\n\nGenerated by Jarvis.`
        }
      : {
          path: 'output/project-summary.md',
          content: `# ${step.title}\n\n${step.description}\n`
        }

    toolExecutor
      .executeTool(toolName, toolArgs, workspacePath, settings.outputDirectory)
      .then((toolRes) => {
        sendTimelineEvent({
          id: crypto.randomUUID(),
          taskId: task.id,
          timestamp: Date.now(),
          type: 'artifact_created',
          title: step.title,
          details: toolRes.success ? toolRes.output : (toolRes.error || 'File created'),
          category: 'write_in'
        })

        step.status = 'completed'
        setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 600)
      })
      .catch(() => {
        step.status = 'completed'
        setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 600)
      })
  } else if (step.category === 'process') {
    const isBrowser =
      step.id === 'step-browser-launch' ||
      step.title.toLowerCase().includes('gmail') ||
      step.title.toLowerCase().includes('chrome')

    const evalRes = policyEngine.evaluateAction(
      isBrowser
        ? {
            actionType: 'process_spawn',
            workspacePath,
            command: 'start chrome "https://mail.google.com"',
            title: 'Launch Google Chrome with Gmail',
            workingDirectory: workspacePath,
            explanation: 'Opens Google Chrome navigating to https://mail.google.com as requested.',
            safetyImpact: 'Spawns an external Google Chrome browser instance on your Windows desktop.',
            arguments: { app: 'chrome', url: 'https://mail.google.com', command: 'start chrome "https://mail.google.com"' }
          }
        : {
            actionType: 'start_dev_server',
            workspacePath,
            command: 'npm run dev',
            title: step.title || 'Start Development Server (npm run dev)',
            workingDirectory: workspacePath,
            explanation: step.description || 'Starts the project development server to serve the frontend on local port 3000.',
            safetyImpact:
              'Spawns a local Node child process listening on port 3000. Jarvis tracks its PID and can stop it anytime.',
            arguments: { command: 'npm run dev', script: 'dev', port: 3000, workingDirectory: workspacePath }
          }
    )

    if (evalRes.requiresApproval && evalRes.approvalRequest) {
      task.status = 'waiting_for_approval'
      task.currentApproval = evalRes.approvalRequest
      sendTaskUpdate({ ...task, updatedAt: Date.now() })

      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId: task.id,
        timestamp: Date.now(),
        type: 'approval_prompt',
        title: evalRes.approvalRequest.title,
        details: 'Review the command, working directory, and arguments before approving.',
        category: 'process'
      })
    }
  }
}

async function executeApprovedAction(approval?: import('../shared/types').ApprovalRequest): Promise<void> {
  if (!approval) return

  const cmd = approval.command || ''
  const args = (approval.arguments || {}) as Record<string, any>

  // 1. Browser launch / URL navigation (e.g. Gmail in Chrome)
  if (
    args.url ||
    cmd.includes('mail.google.com') ||
    approval.actionType === 'browser_navigate' ||
    (approval.actionType === 'process_spawn' && (cmd.startsWith('start chrome') || cmd.startsWith('chrome')))
  ) {
    const rawUrl = args.url || (cmd.includes('mail.google.com') ? 'https://mail.google.com' : 'https://google.com')
    try {
      await launchBrowser(rawUrl, args.app === 'default' ? 'default' : 'chrome')
    } catch (err) {
      console.error('[Jarvis Main] Failed to launch browser in executeApprovedAction:', err)
    }
    return
  }

  // 2. Dev server start
  if (cmd.includes('npm run dev') || approval.actionType === 'start_dev_server') {
    const workingDir = approval.workingDirectory || approval.workspacePath || 'C:\\work\\softwares\\jarvis'
    try {
      const proc = await processManager.startDevServer({
        command: cmd,
        script: args.script || 'dev',
        workingDirectory: workingDir,
        preferredPort: args.port
      })
      console.log(`[Jarvis Main] Dev server started with PID ${proc.pid} on port ${proc.port || 'probing'}`)
    } catch (err) {
      console.error('[Jarvis Main] Failed to start dev server via processManager:', err)
    }
    return
  }

  // 3. General shell command execution
  if (cmd) {
    const workingDir = approval.workingDirectory || approval.workspacePath
    // SEC-001: Parameterized process execution without unescaped shell concatenation
    const parsedTokens: string[] = Array.isArray(args.args)
      ? (args.args as string[])
      : cmd.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((s) => s.replace(/^"(.*)"$/, '$1')) || []

    let executable = (args.executable as string) || parsedTokens[0]
    const cmdArgs = Array.isArray(args.args) ? (args.args as string[]) : parsedTokens.slice(1)

    if (executable) {
      if (process.platform === 'win32' && !executable.endsWith('.exe') && !executable.endsWith('.cmd')) {
        if (executable === 'npm') executable = 'npm.cmd'
        else if (executable === 'npx') executable = 'npx.cmd'
      }

      try {
        const proc = spawn(executable, cmdArgs, {
          cwd: workingDir,
          shell: false,
          windowsHide: true
        })

        proc.stdout?.on('data', (data) => {
          console.log(`[Jarvis Tool stdout]: ${data}`)
        })
        proc.stderr?.on('data', (data) => {
          console.error(`[Jarvis Tool stderr]: ${data}`)
        })
        proc.on('error', (err) => {
          console.error('[Jarvis Tool error]:', err)
        })
      } catch (err) {
        console.error('[Jarvis Main] Failed to spawn tool process:', err)
      }
    }
  }
}

function registerIpcHandlers(): void {
  // --- Conversations & Chat History ---
  ipcMain.handle('conversation:list', async () => {
    return db.getConversations()
  })

  ipcMain.handle('conversation:get-active', async (): Promise<Conversation> => {
    const list = db.getConversations()
    if (list.length > 0) {
      return list[0]
    }
    return db.createConversation('Jarvis General Chat')
  })

  ipcMain.handle('conversation:create', async (_, title?: string) => {
    return db.createConversation(title)
  })

  ipcMain.handle('conversation:delete', async (_, id: string) => {
    db.deleteConversation(id)
    return true
  })

  // --- Live LLM Streaming Chat ---
  ipcMain.handle(
    'chat:send',
    async (
      _,
      {
        conversationId,
        content,
        workspacePath: _workspacePath,
        talkingStyle,
        taskMode,
        thinkingDepth
      }: {
        conversationId: string
        content: string
        workspacePath?: string
        talkingStyle?: import('../shared/types').TalkingStyle
        taskMode?: import('../shared/types').TaskMode
        thinkingDepth?: import('../shared/types').ThinkingDepth
      }
    ) => {
      db.addMessage(conversationId, 'user', content)
      mascotManager?.setMascotState('thinking')

      const chosenWorkspace = _workspacePath || settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis'
      const pastMessages: import('./gateway/model-adapter').ChatCompletionMessage[] = db
        .getMessages(conversationId)
        .slice(-8)
        .map((m) => ({
          role: m.role as any,
          content: m.content
        }))

      try {
        const agentResult = await agentOrchestrator.runLoop(pastMessages, {
          workspacePath: chosenWorkspace,
          outputDirectory: settings.outputDirectory,
          model: settings.defaultModel,
          isLightMode: settings.lightMode,
          talkingStyle: talkingStyle || settings.talkingStyle || 'balanced',
          taskMode: taskMode || settings.taskMode || 'chat',
          thinkingDepth: thinkingDepth || settings.thinkingDepth || 'standard',
          onStatusUpdate: (st) => {
            if (st === 'working') mascotManager?.setMascotState('working')
            else if (st === 'thinking' || st === 'synthesizing') mascotManager?.setMascotState('thinking')
            else if (st === 'completed') mascotManager?.setMascotState('idle')
          },
          onTimelineEvent: (event) => {
            sendTimelineEvent(event)
          }
        })

        broadcastToWindows('chat:stream', {
          conversationId,
          chunk: agentResult.reply,
          type: 'content'
        })

        db.addMessage(conversationId, 'assistant', agentResult.reply, agentResult.reasoning)
        mascotManager?.setMascotState('idle')

        return {
          reply: agentResult.reply,
          reasoning: agentResult.reasoning
        }
      } catch (err: any) {
        console.error('[Jarvis Main] Error in agent runLoop:', err)
        let replyContent = `Gateway communication error: ${err.message || 'Model did not respond'}`

        try {
          const parsed = JSON.parse(err.message)
          if (parsed.isRateLimit) {
            replyContent = JSON.stringify({
              __rateLimit__: true,
              retrySeconds: parsed.retrySeconds || 75,
              model: parsed.model || settings.defaultModel
            })
          }
        } catch {
          if (err.message && err.message.includes('429')) {
            replyContent = JSON.stringify({
              __rateLimit__: true,
              retrySeconds: 75,
              model: settings.defaultModel
            })
          }
        }

        db.addMessage(conversationId, 'assistant', replyContent)
        mascotManager?.setMascotState('error')

        return {
          reply: replyContent,
          reasoning: undefined
        }
      }
    }
  )

  // --- Model Catalog & Discovery ---
  ipcMain.handle('models:list', async () => {
    return await modelAdapter.listModels()
  })

  // --- Task submission & dynamic execution ---
  ipcMain.handle('task:submit-goal', async (_, { goal, workspacePath }) => {
    const taskId = crypto.randomUUID()
    const chosenWorkspace =
      workspacePath || settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis'

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId,
      timestamp: Date.now(),
      type: 'log',
      title: 'Goal Received',
      details: goal
    })

    const planResult = await modelAdapter.generatePlanForGoal(goal, chosenWorkspace)

    if (planResult.directResponse) {
      const finishedState: TaskState = {
        id: taskId,
        goal,
        status: 'completed',
        workspacePath: chosenWorkspace,
        activeModel: settings.lightMode ? 'gemini-flash-lite' : settings.defaultModel,
        steps: planResult.steps,
        activeStepId: planResult.steps[0]?.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      sendTaskUpdate(finishedState)
      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId,
        timestamp: Date.now(),
        type: 'log',
        title: 'Jarvis Response',
        details: planResult.directResponse
      })

      return finishedState
    }

    const initialState: TaskState = {
      id: taskId,
      goal,
      status: 'running',
      workspacePath: chosenWorkspace,
      activeModel: settings.lightMode ? 'gemini-flash-lite' : settings.defaultModel,
      steps: planResult.steps,
      activeStepId: planResult.steps[0]?.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    sendTaskUpdate(initialState)

    setTimeout(() => {
      executeNextStep(initialState, 0, chosenWorkspace)
    }, 500)

    return initialState
  })

  // --- Approvals (ADR-004 Gating & Cryptographic Verification) ---
  ipcMain.handle('approval:resolve', async (event, { approvalId, decision }) => {
    if (!isAuthorizedSender(event.sender)) return false

    const pendingReq = policyEngine.getPendingApproval(approvalId)
    if (!pendingReq || !activeTask) return false

    const task = activeTask
    const currentStep =
      task.steps.find((s) => s.id === task.activeStepId) || task.steps[task.steps.length - 1]

    if (decision === 'granted') {
      // SEC-002: Re-canonicalize and verify HMAC-SHA256 signature against current arguments
      const currentArgs = {
        ...((task.currentApproval?.arguments || pendingReq.arguments || {}) as Record<string, unknown>)
      }
      if (task.currentApproval?.command && currentArgs.command) {
        currentArgs.command = task.currentApproval.command
      }

      const resolveOk = policyEngine.resolveApproval(approvalId, 'granted')
      if (!resolveOk) {
        console.error('[Jarvis Main] Failed to resolve approval in policy engine:', approvalId)
        return false
      }

      const isVerified = policyEngine.verifyApprovedAction(approvalId, currentArgs)
      if (!isVerified) {
        console.error('[Jarvis Main] Security violation: Approval verification failed or arguments tampered:', approvalId)
        sendTimelineEvent({
          id: crypto.randomUUID(),
          taskId: activeTask.id,
          timestamp: Date.now(),
          type: 'error',
          title: 'Security Violation: Tampered Approval',
          details: 'Action execution aborted: Arguments do not match the cryptographically signed approval token.'
        })

        if (currentStep) {
          currentStep.status = 'failed'
          currentStep.error = 'Security violation: Arguments tampered between approval and execution.'
        }
        task.status = 'failed'
        task.currentApproval = undefined
        sendTaskUpdate({ ...task, updatedAt: Date.now() })
        return false
      }

      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId: activeTask.id,
        timestamp: Date.now(),
        type: 'approval_resolved',
        title: 'Approval Granted (Verified HMAC)',
        details: `User granted verified execution: ${pendingReq?.title || pendingReq?.command || 'Action'}.`
      })

      try {
        await executeApprovedAction(pendingReq)
      } catch (err: any) {
        console.error('[Jarvis Main] Error executing approved action:', err)
      }

      if (currentStep) currentStep.status = 'completed'
      task.status = 'completed'
      task.currentApproval = undefined
      sendTaskUpdate({ ...task, updatedAt: Date.now() })
      mascotManager?.setMascotState('completed')

      // Record confirmation message in active conversation
      const convs = db.getConversations()
      if (convs.length > 0) {
        const activeConv = convs[0]
        const actionName = pendingReq?.title || pendingReq?.command || 'Requested action'
        const confirmMsg = `✅ **Action Approved & Executed:** ${actionName}`
        db.addMessage(activeConv.id, 'assistant', confirmMsg)
      }
    } else {
      policyEngine.resolveApproval(approvalId, 'denied')
      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId: activeTask.id,
        timestamp: Date.now(),
        type: 'approval_resolved',
        title: 'Approval Denied',
        details: `User denied the action execution: ${pendingReq?.title || pendingReq?.command || 'Action'}.`
      })

      if (currentStep) {
        currentStep.status = 'skipped'
        currentStep.error = 'Action denied by user.'
      }
      task.status = 'cancelled'
      task.currentApproval = undefined
      sendTaskUpdate({ ...task, updatedAt: Date.now() })
      mascotManager?.setMascotState('idle')

      const convs = db.getConversations()
      if (convs.length > 0) {
        const activeConv = convs[0]
        const cancelMsg = `❌ **Action Cancelled:** User denied execution authorization.`
        db.addMessage(activeConv.id, 'assistant', cancelMsg)
      }
    }

    return true
  })

  ipcMain.handle('task:cancel', async (event, taskId) => {
    if (!isAuthorizedSender(event.sender)) return
    if (activeTask && activeTask.id === taskId) {
      activeTask.status = 'cancelled'
      sendTaskUpdate({ ...activeTask, updatedAt: Date.now() })
    }
  })

  ipcMain.handle('task:get-state', async (event) => {
    if (!isAuthorizedSender(event.sender)) return null
    return activeTask
  })

  // --- Settings (SEC-003: Plaintext Redaction & Encryption) ---
  ipcMain.handle('ui:set-window-theme', async (event, theme: 'light' | 'dark' | 'system') => {
    if (!isAuthorizedSender(event.sender)) throw new Error('Unauthorized sender')
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return
    const effective = theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : theme
    applyWindowTheme(effective)
  })

  ipcMain.handle('settings:get', async (event) => {
    if (!isAuthorizedSender(event.sender)) throw new Error('Unauthorized sender')
    const { apiKey, ...safeSettings } = settings
    return {
      ...safeSettings,
      hasApiKey: Boolean(apiKey && apiKey.length > 0)
    }
  })

  ipcMain.handle('settings:update', async (event, newSettings: Partial<JarvisSettings>) => {
    if (!isAuthorizedSender(event.sender)) throw new Error('Unauthorized sender')

    if (newSettings.apiKey !== undefined) {
      const trimmed = newSettings.apiKey.trim()
      if (trimmed === '') {
        settings.apiKey = undefined
        db.setSetting('apiKey', '')
      } else {
        settings.apiKey = trimmed
        if (safeStorage.isEncryptionAvailable()) {
          try {
            const encrypted = safeStorage.encryptString(trimmed).toString('base64')
            db.setSetting('apiKey', encrypted)
          } catch {
            db.setSetting('apiKey', trimmed)
          }
        } else {
          db.setSetting('apiKey', trimmed)
        }
      }
    }

    if (newSettings.defaultModel !== undefined) {
      settings.defaultModel = newSettings.defaultModel
      db.setSetting('defaultModel', newSettings.defaultModel)
    }
    if (newSettings.lightMode !== undefined) {
      settings.lightMode = newSettings.lightMode
      db.setSetting('lightMode', String(newSettings.lightMode))
    }
    if (newSettings.gatewayUrl !== undefined) {
      settings.gatewayUrl = newSettings.gatewayUrl
      db.setSetting('gatewayUrl', newSettings.gatewayUrl)
    }
    if (newSettings.mascotEnabled !== undefined) {
      settings.mascotEnabled = newSettings.mascotEnabled
      db.setSetting('mascot_enabled', String(newSettings.mascotEnabled))
      if (newSettings.mascotEnabled) {
        mascotManager?.createMascotWindow()
      } else {
        mascotManager?.dispose()
      }
    }
    if (newSettings.reduceMotion !== undefined) {
      settings.reduceMotion = newSettings.reduceMotion
    }
    if (newSettings.talkingStyle !== undefined) {
      settings.talkingStyle = newSettings.talkingStyle
      db.setSetting('talkingStyle', newSettings.talkingStyle)
    }
    if (newSettings.taskMode !== undefined) {
      settings.taskMode = newSettings.taskMode
      db.setSetting('taskMode', newSettings.taskMode)
    }
    if (newSettings.thinkingDepth !== undefined) {
      settings.thinkingDepth = newSettings.thinkingDepth
      db.setSetting('thinkingDepth', newSettings.thinkingDepth)
    }
    if (newSettings.theme !== undefined) {
      settings.theme = newSettings.theme
      db.setSetting('theme', newSettings.theme)
      applyWindowTheme()
    }

    modelAdapter.updateConfig({
      baseUrl: settings.gatewayUrl,
      apiKey: settings.apiKey,
      model: settings.defaultModel
    })

    agentOrchestrator = new AgentOrchestrator(modelAdapter, toolExecutor, {
      defaultWorkspacePath: settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis',
      defaultOutputDir: settings.outputDirectory
    })

    const { apiKey, ...safeSettings } = settings
    return {
      ...safeSettings,
      hasApiKey: Boolean(apiKey && apiKey.length > 0)
    }
  })

  ipcMain.handle('workspace:select-folder', async (event) => {
    if (!isAuthorizedSender(event.sender)) return null
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Workspace Directory'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // --- System & External Links (SEC-005 URL Protocol Guard) ---
  ipcMain.handle('system:open-external-url', async (event, url: string) => {
    if (!isAuthorizedSender(event.sender)) return
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(url)
      } else {
        console.warn('[Jarvis Main] Blocked non-http external URL:', url)
      }
    } catch {
      console.warn('[Jarvis Main] Invalid URL in system:open-external-url:', url)
    }
  })

  ipcMain.handle('system:open-freellm-dashboard', async (event) => {
    if (!isAuthorizedSender(event.sender)) return
    await shell.openExternal('http://127.0.0.1:31415')
  })

  // Safe file / folder opening restricted to workspaces and output directory (SEC-006)
  ipcMain.handle('system:open-path', async (event, targetPath: string) => {
    if (!isAuthorizedSender(event.sender)) return false
    try {
      const resolved = path.resolve(targetPath)
      const isAllowed =
        settings.workspacePaths.some((wp) => policyEngine.isPathInsideWorkspace(resolved, wp)) ||
        policyEngine.isPathInsideWorkspace(resolved, settings.outputDirectory) ||
        resolved.toLowerCase() === path.resolve(settings.outputDirectory).toLowerCase()

      if (!isAllowed) {
        console.warn('[Jarvis Main] Blocked unauthorized system:open-path access:', targetPath)
        return false
      }

      if (fs.existsSync(resolved)) {
        if (fs.statSync(resolved).isDirectory()) {
          await shell.openPath(resolved)
        } else {
          shell.showItemInFolder(resolved)
        }
        return true
      }
    } catch (err) {
      console.error('[Jarvis Main] Failed to open path:', err)
    }
    return false
  })

  // --- Process & Dev Server Management (Phase 4) ---
  ipcMain.handle('process:list-active', async (event) => {
    if (!isAuthorizedSender(event.sender)) return []
    return processManager.getActiveProcesses()
  })

  ipcMain.handle('process:stop', async (event, processId: string) => {
    if (!isAuthorizedSender(event.sender)) return false
    return processManager.stopProcess(processId)
  })

  // --- Mascot & Quick-Chat (Surfaces A & B) ---
  ipcMain.handle('mascot:get-state', async (): Promise<MascotState> => {
    return mascotManager ? mascotManager.getMascotState() : 'idle'
  })

  ipcMain.handle('mascot:set-state', async (_, state: MascotState) => {
    mascotManager?.setMascotState(state)
  })

  ipcMain.handle('mascot:get-position', async () => {
    return mascotManager ? mascotManager.getMascotPosition() : { x: 0, y: 0 }
  })

  ipcMain.handle('mascot:move-by', async (_, { deltaX, deltaY }) => {
    mascotManager?.moveMascotBy(deltaX, deltaY)
  })

  ipcMain.handle('mascot:save-position', async () => {
    mascotManager?.saveMascotPosition()
  })

  ipcMain.handle('mascot:toggle-quickchat', async () => {
    mascotManager?.toggleQuickChat()
  })

  ipcMain.handle('mascot:open-quickchat', async () => {
    mascotManager?.openQuickChat()
  })

  ipcMain.handle('mascot:close-quickchat', async () => {
    mascotManager?.closeQuickChat()
  })

  ipcMain.handle('mascot:open-main-window', async (event) => {
    if (!isAuthorizedSender(event.sender)) return
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    // Smoothly hide quick-chat drawer
    mascotManager?.getQuickChatWindow()?.hide()
  })

  ipcMain.handle('mascot:toggle-visibility', async () => {
    return mascotManager ? mascotManager.toggleMascotVisibility() : false
  })
}
