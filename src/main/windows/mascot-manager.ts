import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { join } from 'path'
import { JarvisDatabase } from '../storage/database'
import { MascotState, MascotPosition } from '../../shared/types'

export class MascotManager {
  private mascotWindow: BrowserWindow | null = null
  private quickChatWindow: BrowserWindow | null = null
  private mainWindowGetter: () => BrowserWindow | null
  private database: JarvisDatabase
  private mascotState: MascotState = 'idle'
  private isDev: boolean
  private devUrl?: string
  private preloadPath: string
  private cursorInterval: NodeJS.Timeout | null = null

  constructor(
    database: JarvisDatabase,
    preloadPath: string,
    isDev: boolean,
    devUrl: string | undefined,
    mainWindowGetter: () => BrowserWindow | null
  ) {
    this.database = database
    this.preloadPath = preloadPath
    this.isDev = isDev
    this.devUrl = devUrl
    this.mainWindowGetter = mainWindowGetter
  }

  public init(): void {
    this.createMascotWindow()
    this.createQuickChatWindow()
  }

  public createMascotWindow(): BrowserWindow {
    if (this.mascotWindow && !this.mascotWindow.isDestroyed()) {
      return this.mascotWindow
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea

    // Retrieve saved position or default to bottom right
    const savedX = this.database.getSetting('mascot_pos_x')
    const savedY = this.database.getSetting('mascot_pos_y')

    let initialX = workArea.x + workArea.width - 220
    let initialY = workArea.y + workArea.height - 250

    if (savedX && savedY) {
      const parsedX = parseInt(savedX, 10)
      const parsedY = parseInt(savedY, 10)
      if (!isNaN(parsedX) && !isNaN(parsedY)) {
        // Clamp to ensure it's visible on available displays
        initialX = Math.max(workArea.x, Math.min(parsedX, workArea.x + workArea.width - 200))
        initialY = Math.max(workArea.y, Math.min(parsedY, workArea.y + workArea.height - 230))
      }
    }

    this.mascotWindow = new BrowserWindow({
      width: 200,
      height: 230,
      x: initialX,
      y: initialY,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    // SEC-005: Window open and navigation guards
    this.mascotWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url)
        }
      } catch {}
      return { action: 'deny' }
    })

    this.mascotWindow.webContents.on('will-navigate', (event, url) => {
      const isDevServer = this.isDev && this.devUrl && url.startsWith(this.devUrl)
      const isLocalFile = url.startsWith('file://')
      if (!isDevServer && !isLocalFile) {
        event.preventDefault()
      }
    })

    if (this.isDev && this.devUrl) {
      this.mascotWindow.loadURL(`${this.devUrl}#mascot`)
    } else {
      this.mascotWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'mascot' })
    }

    this.startCursorTracking()

    this.mascotWindow.on('closed', () => {
      this.stopCursorTracking()
      this.mascotWindow = null
    })

    return this.mascotWindow
  }

  public createQuickChatWindow(): BrowserWindow {    if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
      return this.quickChatWindow
    }

    this.quickChatWindow = new BrowserWindow({
      width: 400,
      height: 560,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: this.resolveQuickChatBackground(),
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    // SEC-005: Window open and navigation guards
    this.quickChatWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url)
        }
      } catch {}
      return { action: 'deny' }
    })

    this.quickChatWindow.webContents.on('will-navigate', (event, url) => {
      const isDevServer = this.isDev && this.devUrl && url.startsWith(this.devUrl)
      const isLocalFile = url.startsWith('file://')
      if (!isDevServer && !isLocalFile) {
        event.preventDefault()
      }
    })

    if (this.isDev && this.devUrl) {
      this.quickChatWindow.loadURL(`${this.devUrl}#quickchat`)
    } else {
      this.quickChatWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quickchat' })
    }

    // Hide quick-chat on blur (optional smooth desktop dismiss)
    this.quickChatWindow.on('blur', () => {
      // Delay slightly so button clicks on mascot don't immediately reopen
      setTimeout(() => {
        if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
          // Keep open if user was interacting
        }
      }, 100)
    })

    this.quickChatWindow.on('closed', () => {
      this.quickChatWindow = null
    })

    return this.quickChatWindow
  }

  public toggleQuickChat(): void {
    if (!this.quickChatWindow || this.quickChatWindow.isDestroyed()) {
      this.createQuickChatWindow()
    }

    if (!this.quickChatWindow) return

    if (this.quickChatWindow.isVisible()) {
      this.quickChatWindow.hide()
      this.setMascotState('idle')
    } else {
      this.positionQuickChatNearMascot()
      this.quickChatWindow.show()
      this.quickChatWindow.focus()
      this.setMascotState('attention')
    }
  }

  public openQuickChat(): void {
    if (!this.quickChatWindow || this.quickChatWindow.isDestroyed()) {
      this.createQuickChatWindow()
    }
    if (!this.quickChatWindow) return

    this.positionQuickChatNearMascot()
    this.quickChatWindow.show()
    this.quickChatWindow.focus()
    this.setMascotState('attention')
  }

  public closeQuickChat(): void {
    if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
      this.quickChatWindow.hide()
      this.setMascotState('idle')
    }
  }

  private positionQuickChatNearMascot(): void {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed() || !this.quickChatWindow) return

    const mascotBounds = this.mascotWindow.getBounds()
    const activeDisplay = screen.getDisplayNearestPoint({ x: mascotBounds.x, y: mascotBounds.y })
    const workArea = activeDisplay.workArea

    const chatWidth = 380
    const chatHeight = 520

    // Try placing to the left of mascot
    let chatX = mascotBounds.x - chatWidth - 12
    if (chatX < workArea.x) {
      // Not enough room on the left, place to the right
      chatX = mascotBounds.x + mascotBounds.width + 12
    }

    // Vertically center with mascot, but clamp within screen
    let chatY = mascotBounds.y - 120
    chatY = Math.max(workArea.y + 12, Math.min(chatY, workArea.y + workArea.height - chatHeight - 12))

    this.quickChatWindow.setBounds({
      x: Math.round(chatX),
      y: Math.round(chatY),
      width: chatWidth,
      height: chatHeight
    })
  }

  public moveMascotBy(deltaX: number, deltaY: number): void {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed()) return

    const bounds = this.mascotWindow.getBounds()
    const currentDisplay = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const workArea = currentDisplay.workArea

    const newX = Math.max(workArea.x - 20, Math.min(bounds.x + deltaX, workArea.x + workArea.width - bounds.width + 20))
    const newY = Math.max(workArea.y - 20, Math.min(bounds.y + deltaY, workArea.y + workArea.height - bounds.height + 20))

    this.mascotWindow.setPosition(Math.round(newX), Math.round(newY))

    // If quick-chat is visible, follow the mascot
    if (this.quickChatWindow && !this.quickChatWindow.isDestroyed() && this.quickChatWindow.isVisible()) {
      this.positionQuickChatNearMascot()
    }
  }

  public saveMascotPosition(): void {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed()) return
    const [x, y] = this.mascotWindow.getPosition()
    this.database.setSetting('mascot_pos_x', String(x))
    this.database.setSetting('mascot_pos_y', String(y))
  }

  public getMascotPosition(): MascotPosition {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed()) {
      return { x: 0, y: 0 }
    }
    const [x, y] = this.mascotWindow.getPosition()
    return { x, y }
  }

  public setMascotState(state: MascotState): void {
    this.mascotState = state
    if (this.mascotWindow && !this.mascotWindow.isDestroyed()) {
      this.mascotWindow.webContents.send('mascot:state-changed', state)
    }
  }

  public getMascotState(): MascotState {
    return this.mascotState
  }

  public toggleMascotVisibility(): boolean {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed()) {
      this.createMascotWindow()
      return true
    }

    if (this.mascotWindow.isVisible()) {
      this.mascotWindow.hide()
      if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
        this.quickChatWindow.hide()
      }
      return false
    } else {
      this.mascotWindow.show()
      return true
    }
  }

  public openMainWindow(): void {
    const main = this.mainWindowGetter()
    if (main && !main.isDestroyed()) {
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
    }
    // Dismiss quick-chat smoothly
    if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
      this.quickChatWindow.hide()
    }
  }

  public getMascotWindow(): BrowserWindow | null {
    return this.mascotWindow
  }

  public getQuickChatWindow(): BrowserWindow | null {
    return this.quickChatWindow
  }

  private resolveQuickChatBackground(): string {
    const saved = this.database.getSetting('theme')
    const isDark =
      saved === 'dark' || (saved !== 'light' && nativeTheme.shouldUseDarkColors)
    return isDark ? '#0d1411' : '#f2eee5'
  }

  public setQuickChatTheme(theme: 'light' | 'dark'): void {
    if (!this.quickChatWindow || this.quickChatWindow.isDestroyed()) return
    this.quickChatWindow.setBackgroundColor(theme === 'dark' ? '#0d1411' : '#f2eee5')
  }

  public getCursorOffsetFromMascot(): { nx: number; ny: number } {
    if (!this.mascotWindow || this.mascotWindow.isDestroyed()) return { nx: 0, ny: 0 }

    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = this.mascotWindow.getPosition()
    const [winW, winH] = this.mascotWindow.getSize()

    const mascotCenterX = winX + winW / 2
    const mascotCenterY = winY + winH / 2

    const primaryDisplay = screen.getPrimaryDisplay()
    const screenW = primaryDisplay.workAreaSize.width
    const screenH = primaryDisplay.workAreaSize.height

    // Normalized offsets from -1.0 to +1.0 across full screen
    const nx = Math.max(-1, Math.min(1, (cursor.x - mascotCenterX) / (screenW / 2)))
    const ny = Math.max(-1, Math.min(1, (cursor.y - mascotCenterY) / (screenH / 2)))

    return { nx, ny }
  }

  public startCursorTracking(): void {
    if (this.cursorInterval) return
    this.cursorInterval = setInterval(() => {
      if (this.mascotWindow && !this.mascotWindow.isDestroyed() && this.mascotWindow.isVisible()) {
        const offset = this.getCursorOffsetFromMascot()
        this.mascotWindow.webContents.send('mascot:cursor-tracking', offset)
      }
    }, 16) // ~60 FPS high-precision full desktop cursor tracking
  }

  public stopCursorTracking(): void {
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval)
      this.cursorInterval = null
    }
  }

  public dispose(): void {
    this.stopCursorTracking()
    if (this.quickChatWindow && !this.quickChatWindow.isDestroyed()) {
      this.quickChatWindow.close()
    }
    if (this.mascotWindow && !this.mascotWindow.isDestroyed()) {
      this.mascotWindow.close()
    }
  }
}
