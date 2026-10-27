import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { MascotManager } from './mascot-manager'

export class TrayManager {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private mascotManager: MascotManager | null = null
  private onExportDiagnostics?: () => Promise<string | null>

  constructor(
    mainWindow: BrowserWindow | null,
    mascotManager: MascotManager | null,
    onExportDiagnostics?: () => Promise<string | null>
  ) {
    this.mainWindow = mainWindow
    this.mascotManager = mascotManager
    this.onExportDiagnostics = onExportDiagnostics
  }

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win
  }

  public init(): void {
    if (this.tray) return

    // Resolve tray icon from resources
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'resources/icon.ico')
      : join(__dirname, '../../resources/icon.ico')

    let icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      // Fallback empty transparent icon
      icon = nativeImage.createEmpty()
    }

    this.tray = new Tray(icon)
    this.tray.setToolTip('Jarvis — Personal Desktop AI Assistant')

    this.tray.on('click', () => {
      this.toggleMainWindow()
    })

    this.updateContextMenu('online')
  }

  public updateContextMenu(gatewayStatus: 'online' | 'degraded' | 'offline' = 'online'): void {
    if (!this.tray) return

    const statusLabel =
      gatewayStatus === 'online'
        ? '● Gateway: Online (31415)'
        : gatewayStatus === 'degraded'
          ? '▲ Gateway: Degraded'
          : '○ Gateway: Offline'

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Jarvis Personal Assistant',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Main Window',
        click: () => this.showMainWindow()
      },
      {
        label: 'Quick Chat',
        accelerator: 'Ctrl+Shift+J',
        click: () => this.mascotManager?.openQuickChat()
      },
      {
        label: 'Toggle 3D Mascot',
        click: () => this.mascotManager?.toggleMascotVisibility()
      },
      { type: 'separator' },
      {
        label: statusLabel,
        enabled: false
      },
      {
        label: 'Export Diagnostics Bundle',
        click: async () => {
          if (this.onExportDiagnostics) {
            await this.onExportDiagnostics()
          }
        }
      },
      {
        label: 'Settings...',
        click: () => {
          this.showMainWindow()
          this.mainWindow?.webContents.send('ui:open-settings')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Jarvis',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (this.mainWindow.isMinimized()) this.mainWindow.restore()
    this.mainWindow.show()
    this.mainWindow.focus()
  }

  public toggleMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide()
    } else {
      this.showMainWindow()
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
