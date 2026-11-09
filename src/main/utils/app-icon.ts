import { app, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'fs'

/**
 * Resolves the absolute path to the application icon.
 * Prefers multi-resolution Windows .ico with fallback to transparent .png.
 */
export function getAppIconPath(): string {
  const candidates = [
    app.isPackaged ? join(process.resourcesPath, 'resources/icon.ico') : join(__dirname, '../../resources/icon.ico'),
    app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(process.cwd(), 'resources/icon.ico'),
    join(process.cwd(), 'resources', 'icon.ico'),
    app.isPackaged ? join(process.resourcesPath, 'resources/icon.png') : join(__dirname, '../../resources/icon.png'),
    join(process.cwd(), 'resources', 'icon.png')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return join(process.cwd(), 'resources', 'icon.ico')
}

/**
 * Returns a loaded Electron NativeImage of the application icon
 * for window taskbar representation and system tray.
 */
export function getAppIcon(): Electron.NativeImage {
  const iconPath = getAppIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) {
    return icon
  }
  return nativeImage.createEmpty()
}
