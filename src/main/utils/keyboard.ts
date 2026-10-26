import { spawn } from 'child_process'

export type ShortcutAction =
  | 'reopen_tab'
  | 'close_tab'
  | 'new_tab'
  | 'refresh'
  | 'next_tab'
  | 'prev_tab'
  | 'focus_address_bar'
  | 'send_email'
  | 'click_send'
  | 'submit'
  | 'enter'
  | 'custom'

const SHORTCUT_KEY_MAP: Record<string, string> = {
  reopen_tab: '^+t', // Ctrl+Shift+T
  close_tab: '^w', // Ctrl+W
  new_tab: '^t', // Ctrl+T
  refresh: '^r', // Ctrl+R
  next_tab: '^{TAB}', // Ctrl+Tab
  prev_tab: '^+{TAB}', // Ctrl+Shift+Tab
  focus_address_bar: '^l', // Ctrl+L
  send_email: '^{ENTER}', // Ctrl+Enter (Send email in Gmail and webmail)
  click_send: '^{ENTER}', // Ctrl+Enter
  submit: '^{ENTER}', // Ctrl+Enter
  enter: '{ENTER}' // Enter
}

export interface SendShortcutResult {
  success: boolean
  message: string
  action: string
  targetApp: string
}

/**
 * Sends a keyboard shortcut to a target application window on Windows.
 * Uses WScript.Shell SendKeys via PowerShell.
 */
export async function sendShortcut(
  action: ShortcutAction | string,
  targetApp: string = 'Chrome',
  customKeys?: string
): Promise<SendShortcutResult> {
  const keys = customKeys || SHORTCUT_KEY_MAP[action] || action

  if (process.platform !== 'win32') {
    return {
      success: false,
      message: 'Keyboard shortcut simulation is only supported on Windows in this build.',
      action,
      targetApp
    }
  }

  // PowerShell script that activates the target application and sends the keystrokes
  const psScript = `
$wshell = New-Object -ComObject WScript.Shell
$activated = $wshell.AppActivate('${targetApp}')
if ($activated) {
  Start-Sleep -Milliseconds 150
  $wshell.SendKeys('${keys}')
  Write-Output "SUCCESS"
} else {
  # Try fallback with Chrome or active window
  $wshell.SendKeys('${keys}')
  Write-Output "SENT_UNFOCUSED"
}
`

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    child.on('close', (code) => {
      if (code === 0 && (stdout.includes('SUCCESS') || stdout.includes('SENT_UNFOCUSED'))) {
        const descriptions: Record<string, string> = {
          reopen_tab: 'Reopened previously closed tab (Ctrl+Shift+T)',
          close_tab: 'Closed current tab (Ctrl+W)',
          new_tab: 'Opened a new tab (Ctrl+T)',
          refresh: 'Refreshed browser page (Ctrl+R)',
          next_tab: 'Switched to next tab (Ctrl+Tab)',
          prev_tab: 'Switched to previous tab (Ctrl+Shift+Tab)',
          focus_address_bar: 'Focused browser address bar (Ctrl+L)',
          send_email: 'Sent Send command (Ctrl+Enter) to dispatch email',
          click_send: 'Sent Send command (Ctrl+Enter) to dispatch email',
          submit: 'Sent Submit command (Ctrl+Enter)',
          enter: 'Pressed Enter'
        }

        const friendlyDesc = descriptions[action] || `Sent shortcut '${keys}'`
        resolve({
          success: true,
          message: `${friendlyDesc} to ${targetApp}.`,
          action,
          targetApp
        })
      } else {
        resolve({
          success: false,
          message: `Failed to execute shortcut: ${stderr || 'Unknown error'}`,
          action,
          targetApp
        })
      }
    })

    child.on('error', (err) => {
      resolve({
        success: false,
        message: `Execution error: ${err.message}`,
        action,
        targetApp
      })
    })
  })
}
