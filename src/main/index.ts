import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PolicyEngine } from './policy/policy-engine'
import { ModelGatewayAdapter } from './gateway/model-adapter'
import { TaskState, TimelineEvent, JarvisSettings } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const policyEngine = new PolicyEngine()

// In-memory runtime state for tasks
let activeTask: TaskState | null = null

const settings: JarvisSettings = {
  gatewayUrl: 'http://127.0.0.1:31415/v1',
  apiKey: process.env.FREELLMAPI_API_KEY,
  defaultModel: 'gemini-3.6-flash',
  workspacePaths: ['C:\\work\\softwares\\jarvis'],
  theme: 'dark',
  outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
}

const modelAdapter = new ModelGatewayAdapter({
  baseUrl: settings.gatewayUrl,
  apiKey: settings.apiKey,
  model: settings.defaultModel
})

function createWindow(): void {
  const preloadPath = fs.existsSync(join(__dirname, '../preload/index.cjs'))
    ? join(__dirname, '../preload/index.cjs')
    : fs.existsSync(join(__dirname, '../preload/index.mjs'))
      ? join(__dirname, '../preload/index.mjs')
      : join(__dirname, '../preload/index.js')

  console.log('[Jarvis Main] Preload path resolved:', preloadPath)

  mainWindow = new BrowserWindow({
    width: 1050,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Jarvis — Personal AI Assistant',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('[Jarvis Main] Window ready-to-show')
    mainWindow?.show()
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
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline' http://localhost:5173; img-src 'self' data: http://localhost:5173; connect-src 'self' http://localhost:5173 ws://localhost:5173 http://127.0.0.1:31415"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:31415"

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
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jarvis.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function sendTaskUpdate(state: TaskState): void {
  activeTask = state
  mainWindow?.webContents.send('task:updated', state)
}

function sendTimelineEvent(event: TimelineEvent): void {
  mainWindow?.webContents.send('timeline:event', event)
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

  // Route step execution by category / action
  if (step.category === 'read_in') {
    const res = policyEngine.evaluateAction({
      actionType: 'workspace_list',
      workspacePath,
      targetPath: workspacePath,
      arguments: { path: workspacePath }
    })

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId: task.id,
      timestamp: Date.now(),
      type: 'tool_call',
      title: step.title,
      details: res.reason,
      category: 'read_in'
    })

    step.status = 'completed'
    setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 800)
  } else if (step.category === 'write_in') {
    const targetFile = join(workspacePath, 'output', 'project-summary.pdf')
    const res = policyEngine.evaluateAction({
      actionType: 'file_write_new',
      workspacePath,
      targetPath: targetFile,
      arguments: { targetFile }
    })

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId: task.id,
      timestamp: Date.now(),
      type: 'artifact_created',
      title: step.title,
      details: res.reason,
      category: 'write_in'
    })

    step.status = 'completed'
    setTimeout(() => executeNextStep(task, stepIndex + 1, workspacePath), 800)
  } else if (step.category === 'process') {
    // Process requires explicit approval per ADR-004
    const evalRes = policyEngine.evaluateAction({
      actionType: 'start_dev_server',
      workspacePath,
      command: 'npm run dev',
      title: 'Start Development Server (npm run dev)',
      workingDirectory: workspacePath,
      explanation: 'Starts the project development server to serve the frontend on local port 3000.',
      safetyImpact: 'Spawns a local Node child process listening on port 3000. Jarvis tracks its PID and can stop it anytime.',
      arguments: { command: 'npm run dev', script: 'dev', port: 3000, workingDirectory: workspacePath }
    })

    if (evalRes.requiresApproval && evalRes.approvalRequest) {
      task.status = 'waiting_for_approval'
      task.currentApproval = evalRes.approvalRequest
      sendTaskUpdate({ ...task, updatedAt: Date.now() })

      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId: task.id,
        timestamp: Date.now(),
        type: 'approval_prompt',
        title: 'Action Requires Approval: Start Dev Server',
        details: 'Review the command, working directory, and arguments before approving.',
        category: 'process'
      })
    }
  }
}

function registerIpcHandlers(): void {
  // Task submission & dynamic execution
  ipcMain.handle('task:submit-goal', async (_, { goal, workspacePath }) => {
    const taskId = crypto.randomUUID()
    const chosenWorkspace = workspacePath || settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis'

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId,
      timestamp: Date.now(),
      type: 'log',
      title: 'Goal Received',
      details: goal
    })

    // Plan generation via ModelGatewayAdapter
    const planResult = await modelAdapter.generatePlanForGoal(goal, chosenWorkspace)

    // Direct Conversational Response (e.g. "who are u ?")
    if (planResult.directResponse) {
      const finishedState: TaskState = {
        id: taskId,
        goal,
        status: 'completed',
        workspacePath: chosenWorkspace,
        activeModel: settings.defaultModel,
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

    // Operational Task Execution
    const initialState: TaskState = {
      id: taskId,
      goal,
      status: 'running',
      workspacePath: chosenWorkspace,
      activeModel: settings.defaultModel,
      steps: planResult.steps,
      activeStepId: planResult.steps[0]?.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    sendTaskUpdate(initialState)

    // Sequentially process steps
    setTimeout(() => {
      executeNextStep(initialState, 0, chosenWorkspace)
    }, 500)

    return initialState
  })

  // Approval resolution
  ipcMain.handle('approval:resolve', async (_, { approvalId, decision }) => {
    const success = policyEngine.resolveApproval(approvalId, decision)
    if (!success || !activeTask) return false

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId: activeTask.id,
      timestamp: Date.now(),
      type: 'approval_resolved',
      title: decision === 'granted' ? 'Approval Granted' : 'Approval Denied',
      details: `User ${decision} the action execution.`
    })

    const task = activeTask
    const currentStep =
      task.steps.find((s) => s.id === task.activeStepId) ||
      task.steps[task.steps.length - 1]

    if (decision === 'granted') {
      if (currentStep) currentStep.status = 'completed'
      task.status = 'completed'
      task.currentApproval = undefined
      sendTaskUpdate({ ...task, updatedAt: Date.now() })
    } else {
      if (currentStep) {
        currentStep.status = 'skipped'
        currentStep.error = 'Action denied by user.'
      }
      task.status = 'cancelled'
      task.currentApproval = undefined
      sendTaskUpdate({ ...task, updatedAt: Date.now() })
    }

    return true
  })

  ipcMain.handle('task:cancel', async (_, taskId) => {
    if (activeTask && activeTask.id === taskId) {
      activeTask.status = 'cancelled'
      sendTaskUpdate({ ...activeTask, updatedAt: Date.now() })
    }
  })

  ipcMain.handle('task:get-state', async () => activeTask)

  ipcMain.handle('settings:get', async () => settings)

  ipcMain.handle('settings:update', async (_, newSettings) => {
    Object.assign(settings, newSettings)
    return settings
  })

  ipcMain.handle('workspace:select-folder', async () => {
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
}
