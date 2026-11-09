import { BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { JarvisDatabase } from '../storage/database'

export class SettingsWindowManager {
  private settingsWindow: BrowserWindow | null = null
  private preloadPath: string
  private devUrl: string | null
  private isDev: boolean
  private database: JarvisDatabase

  constructor(
    preloadPath: string,
    devUrl: string | null,
    isDev: boolean,
    database: JarvisDatabase
  ) {
    this.preloadPath = preloadPath
    this.devUrl = devUrl
    this.isDev = isDev
    this.database = database
  }

  public getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow
  }

  public openSettingsWindow(initialTab?: string): BrowserWindow {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (initialTab) {
        this.settingsWindow.webContents.send('settings:navigate-tab', initialTab)
      }
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore()
      }
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    const savedTheme = this.database.getSetting('theme') || 'dark'
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && nativeTheme.shouldUseDarkColors)
    const bgColor = isDark ? '#0d1411' : '#f2eee5'
    const symbolColor = isDark ? '#f3eee3' : '#121212'

    this.settingsWindow = new BrowserWindow({
      width: 940,
      height: 700,
      minWidth: 760,
      minHeight: 520,
      frame: false,
      title: 'Jarvis — Configuration & Settings',
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: bgColor,
        symbolColor: symbolColor,
        height: 38
      },
      show: false,
      backgroundColor: bgColor,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    // SEC-005: Window open and navigation guards
    this.settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url)
        }
      } catch (err) {
        console.error('[SettingsWindow] Invalid URL in window.open:', err)
      }
      return { action: 'deny' }
    })

    this.settingsWindow.webContents.on('will-navigate', (event, url) => {
      const isDevServer = this.isDev && this.devUrl && url.startsWith(this.devUrl)
      if (!isDevServer) {
        event.preventDefault()
        try {
          const parsed = new URL(url)
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            shell.openExternal(url)
          }
        } catch {
          // Block navigation
        }
      }
    })

    const hashTarget = initialTab ? `settings?tab=${initialTab}` : 'settings'

    if (this.isDev && this.devUrl) {
      this.settingsWindow.loadURL(`${this.devUrl}#${hashTarget}`)
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: hashTarget })
    }

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow?.show()
      this.settingsWindow?.focus()
    })

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })

    return this.settingsWindow
  }

  public closeSettingsWindow(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close()
      this.settingsWindow = null
    }
  }

  public setSettingsTheme(theme: 'light' | 'dark'): void {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) return
    const isDark = theme === 'dark'
    const bgColor = isDark ? '#0d1411' : '#f2eee5'
    const symbolColor = isDark ? '#f3eee3' : '#121212'

    this.settingsWindow.setBackgroundColor(bgColor)
    if (this.settingsWindow.setTitleBarOverlay) {
      this.settingsWindow.setTitleBarOverlay({
        color: bgColor,
        symbolColor: symbolColor,
        height: 38
      })
    }
  }
}
