import { spawn } from 'child_process'
import fs from 'fs'
import { join } from 'path'
import { shell } from 'electron'

/**
 * Searches common Windows install locations for the Google Chrome executable.
 */
export function getChromeExecutablePath(): string | null {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      : null
  ].filter(Boolean) as string[]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export interface LaunchBrowserResult {
  success: boolean
  message: string
  url: string
  usedBrowser: 'chrome' | 'default'
}

/**
 * Launches Google Chrome or default system browser to navigate to a target URL.
 * Enforces http/https protocol safety.
 */
export async function launchBrowser(
  url: string = 'https://google.com',
  preferredBrowser: 'chrome' | 'default' = 'chrome'
): Promise<LaunchBrowserResult> {
  let validatedUrl: URL
  try {
    validatedUrl = new URL(url)
    if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
      throw new Error(`Forbidden protocol '${validatedUrl.protocol}'. Only http: and https: URLs are permitted.`)
    }
  } catch (err: any) {
    throw new Error(`Invalid URL: ${err.message}`)
  }

  const targetUrl = validatedUrl.toString()

  if (preferredBrowser === 'chrome') {
    const chromePath = getChromeExecutablePath()
    if (chromePath) {
      try {
        const child = spawn(chromePath, [targetUrl], {
          windowsHide: false,
          shell: false,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        return {
          success: true,
          message: `Successfully launched Google Chrome navigating to ${targetUrl}`,
          url: targetUrl,
          usedBrowser: 'chrome'
        }
      } catch (err) {
        console.warn('[Browser Launch] Direct Chrome launch failed, falling back to cmd:', err)
      }
    }

    // Fallback: spawn via cmd.exe start
    try {
      const child = spawn('cmd.exe', ['/c', 'start', '', 'chrome', targetUrl], {
        windowsHide: true,
        shell: false,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      return {
        success: true,
        message: `Launched Chrome navigating to ${targetUrl}`,
        url: targetUrl,
        usedBrowser: 'chrome'
      }
    } catch (err) {
      console.warn('[Browser Launch] cmd start chrome failed, falling back to default browser:', err)
    }
  }

  // System default browser fallback via Electron shell
  await shell.openExternal(targetUrl)
  return {
    success: true,
    message: `Navigated to ${targetUrl} in system default browser`,
    url: targetUrl,
    usedBrowser: 'default'
  }
}
