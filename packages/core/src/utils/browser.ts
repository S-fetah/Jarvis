import { spawn } from 'child_process'
import fs from 'fs'
import { join } from 'path'
import { shell } from 'electron'
import { resolveProfileDirectory } from './chrome-profiles'

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
  preferredBrowser: 'chrome' | 'default' = 'chrome',
  profile?: string,
  enableCdp: boolean = true,
  minimized: boolean = false
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
  const resolvedProfile = resolveProfileDirectory(profile)
  const cdpArgs = enableCdp ? ['--remote-debugging-port=9222'] : []
  const minimizedArgs = minimized ? ['--window-position=-32000,-32000'] : []

  if (preferredBrowser === 'chrome') {
    const chromePath = getChromeExecutablePath()
    const chromeArgs = [
      ...cdpArgs,
      ...minimizedArgs,
      ...(resolvedProfile ? [`--profile-directory=${resolvedProfile}`] : []),
      targetUrl
    ]

    if (chromePath) {
      try {
        const child = spawn(chromePath, chromeArgs, {
          windowsHide: false,
          shell: false,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        return {
          success: true,
          message: `Successfully launched Google Chrome${resolvedProfile ? ` (Profile: ${resolvedProfile})` : ''}${minimized ? ' [Minimized/Background]' : ''} navigating to ${targetUrl}`,
          url: targetUrl,
          usedBrowser: 'chrome'
        }
      } catch (err) {
        console.warn('[Browser Launch] Direct Chrome launch failed, falling back to cmd:', err)
      }
    }

    // Fallback: spawn via cmd.exe start
    try {
      const cmdArgs = [
        '/c',
        'start',
        '',
        ...(minimized ? ['/min'] : []),
        'chrome',
        ...cdpArgs,
        ...minimizedArgs,
        ...(resolvedProfile ? [`--profile-directory=${resolvedProfile}`] : []),
        targetUrl
      ]
      const child = spawn('cmd.exe', cmdArgs, {
        windowsHide: true,
        shell: false,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      return {
        success: true,
        message: `Launched Chrome${resolvedProfile ? ` (Profile: ${resolvedProfile})` : ''} navigating to ${targetUrl}`,
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
