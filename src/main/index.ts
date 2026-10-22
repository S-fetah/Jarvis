import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PolicyEngine } from './policy/policy-engine'
import { TaskState, TimelineEvent, JarvisSettings } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const policyEngine = new PolicyEngine()

// In-memory runtime state for tasks
let activeTask: TaskState | null = null

const settings: JarvisSettings = {
  gatewayUrl: 'http://127.0.0.1:31415/v1',
  defaultModel: 'gemini-3.6-flash',
  workspacePaths: ['C:\\work\\softwares\\jarvis'],
  theme: 'dark',
  outputDirectory: 'C:\\work\\softwares\\jarvis\\output'
}

function createWindow(): void {
  const preloadPath = fs.existsSync(join(__dirname, '../preload/index.mjs'))
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
      sandbox: false, // sandbox: false ensures local preload scripts load reliably across Electron versions
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

function registerIpcHandlers(): void {
  // Task submission & simulation
  ipcMain.handle('task:submit-goal', async (_, { goal, workspacePath }) => {
    const taskId = crypto.randomUUID()
    const chosenWorkspace = workspacePath || settings.workspacePaths[0] || 'C:\\work\\softwares\\jarvis'

    const initialState: TaskState = {
      id: taskId,
      goal,
      status: 'planning',
      workspacePath: chosenWorkspace,
      activeModel: settings.defaultModel,
      steps: [
        {
          id: 'step-1',
          title: 'Inspect Workspace',
          description: 'Read workspace files and project manifest.',
          category: 'read_in',
          status: 'in_progress'
        },
        {
          id: 'step-2',
          title: 'Generate Project Summary PDF',
          description: 'Synthesize research and output document.',
          category: 'write_in',
          status: 'pending'
        },
        {
          id: 'step-3',
          title: 'Start Development Server',
          description: 'Run project start script on local port.',
          category: 'process',
          status: 'pending'
        }
      ],
      activeStepId: 'step-1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    sendTaskUpdate(initialState)

    sendTimelineEvent({
      id: crypto.randomUUID(),
      taskId,
      timestamp: Date.now(),
      type: 'log',
      title: 'Goal received',
      details: goal
    })

    // Simulate Step 1: Read-in (Allowed without approval)
    setTimeout(() => {
      const evalStep1 = policyEngine.evaluateAction({
        actionType: 'workspace_list',
        workspacePath: chosenWorkspace,
        targetPath: chosenWorkspace,
        arguments: { recursive: true }
      })

      sendTimelineEvent({
        id: crypto.randomUUID(),
        taskId,
        timestamp: Date.now(),
        type: 'tool_call',
        title: 'workspace_list executed',
        details: evalStep1.reason,
        category: 'read_in'
      })

      // Update plan to Step 2
      initialState.steps[0].status = 'completed'
      initialState.steps[1].status = 'in_progress'
      initialState.activeStepId = 'step-2'
      sendTaskUpdate({ ...initialState, updatedAt: Date.now() })

      // Simulate Step 2: Write-in (Allowed for new files)
      setTimeout(() => {
        const evalStep2 = policyEngine.evaluateAction({
          actionType: 'file_write_new',
          workspacePath: chosenWorkspace,
          targetPath: join(chosenWorkspace, 'summary.pdf'),
          arguments: { filename: 'summary.pdf', sizeBytes: 15400 }
        })

        sendTimelineEvent({
          id: crypto.randomUUID(),
          taskId,
          timestamp: Date.now(),
          type: 'artifact_created',
          title: 'summary.pdf generated',
          details: evalStep2.reason,
          category: 'write_in'
        })

        initialState.steps[1].status = 'completed'
        initialState.steps[2].status = 'in_progress'
        initialState.activeStepId = 'step-3'

        // Step 3: Process execution -> Requires Approval!
        const evalStep3 = policyEngine.evaluateAction({
          actionType: 'start_dev_server',
          workspacePath: chosenWorkspace,
          command: 'npm run dev',
          arguments: { script: 'dev', port: 3000 }
        })

        if (evalStep3.requiresApproval && evalStep3.approvalRequest) {
          initialState.status = 'waiting_for_approval'
          initialState.currentApproval = evalStep3.approvalRequest
          sendTaskUpdate({ ...initialState, updatedAt: Date.now() })

          sendTimelineEvent({
            id: crypto.randomUUID(),
            taskId,
            timestamp: Date.now(),
            type: 'approval_prompt',
            title: 'Approval Required: Start Dev Server',
            details: 'Action requires user permission before launching process.',
            category: 'process'
          })
        }
      }, 1000)
    }, 1000)

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

    if (decision === 'granted') {
      activeTask.status = 'completed'
      activeTask.steps[2].status = 'completed'
      activeTask.currentApproval = undefined
      sendTaskUpdate({ ...activeTask, updatedAt: Date.now() })
    } else {
      activeTask.status = 'cancelled'
      activeTask.steps[2].status = 'skipped'
      activeTask.steps[2].error = 'Action denied by user.'
      activeTask.currentApproval = undefined
      sendTaskUpdate({ ...activeTask, updatedAt: Date.now() })
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
