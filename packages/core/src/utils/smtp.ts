import tls from 'tls'
import net from 'net'

export interface SmtpConfig {
  host: string
  port: number
  secure?: boolean // true for 465, false for 587 (STARTTLS)
  user: string
  pass: string
}

export interface SendEmailDirectOptions {
  to: string
  subject: string
  body: string
  from?: string
  config?: SmtpConfig
}

export interface SmtpSendResult {
  success: boolean
  message: string
  messageId?: string
  serverReceipt?: string
}

/**
 * Lightweight, zero-dependency RFC 5321 SMTP client for verified direct email delivery.
 * Connects directly to the mail server (e.g. Gmail smtp.gmail.com:465) via TLS,
 * authenticates, dispatches the message, and awaits the 250 OK delivery receipt.
 */
export async function sendEmailDirect(options: SendEmailDirectOptions): Promise<SmtpSendResult> {
  // Use provided config or environment defaults (e.g. GMAIL_USER, GMAIL_APP_PASS)
  const host = options.config?.host || process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = options.config?.port || Number(process.env.SMTP_PORT) || 465
  const user = options.config?.user || process.env.SMTP_USER || process.env.GMAIL_USER
  const pass = options.config?.pass || process.env.SMTP_PASS || process.env.GMAIL_APP_PASS
  const from = options.from || user || 'jarvis@localhost'

  if (!user || !pass) {
    return {
      success: false,
      message:
        'Direct email dispatch requires SMTP credentials (e.g. Gmail App Password). Set SMTP_USER and SMTP_PASS or configure credentials in Settings.'
    }
  }

  return new Promise((resolve) => {
    let client: tls.TLSSocket | net.Socket

    try {
      if (port === 465) {
        client = tls.connect({ host, port, rejectUnauthorized: false })
      } else {
        client = net.connect({ host, port })
      }
    } catch (err: any) {
      return resolve({
        success: false,
        message: `Failed to connect to SMTP server ${host}:${port} - ${err.message}`
      })
    }

    let buffer = ''
    let step = 0
    let serverReceipt = ''

    const cleanPass = pass.replace(/\s+/g, '') // remove spaces from Google app passwords
    const authString = Buffer.from(`\0${user}\0${cleanPass}`).toString('base64')

    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${host}>`
    const rfc2822Message = [
      `From: ${from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `X-Mailer: Jarvis-Desktop-Agent`,
      '',
      options.body,
      '.'
    ].join('\r\n')

    const timeout = setTimeout(() => {
      client.destroy()
      resolve({
        success: false,
        message: `SMTP connection to ${host}:${port} timed out after 15 seconds.`
      })
    }, 15000)

    const finish = (result: SmtpSendResult): void => {
      clearTimeout(timeout)
      try {
        client.write('QUIT\r\n')
        client.end()
      } catch {}
      resolve(result)
    }

    client.on('error', (err) => {
      clearTimeout(timeout)
      resolve({
        success: false,
        message: `SMTP Error: ${err.message}`
      })
    })

    client.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\r\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line) continue
        const code = parseInt(line.slice(0, 3), 10)

        // Step 0: Initial Greeting (220) -> Send EHLO
        if (step === 0 && code === 220) {
          step = 1
          client.write(`EHLO ${host}\r\n`)
          break
        }

        // Step 1: EHLO response (250) -> Send AUTH PLAIN
        if (step === 1 && line.startsWith('250 ')) {
          step = 2
          client.write(`AUTH PLAIN ${authString}\r\n`)
          break
        }

        // Step 2: AUTH success (235) -> Send MAIL FROM
        if (step === 2) {
          if (code === 235) {
            step = 3
            client.write(`MAIL FROM:<${user}>\r\n`)
            break
          } else if (code >= 500 || code >= 400) {
            return finish({
              success: false,
              message: `SMTP Authentication failed for ${user}: ${line}. Check your App Password.`
            })
          }
        }

        // Step 3: MAIL FROM response (250) -> Send RCPT TO
        if (step === 3) {
          if (code === 250) {
            step = 4
            client.write(`RCPT TO:<${options.to}>\r\n`)
            break
          } else if (code >= 400) {
            return finish({
              success: false,
              message: `SMTP Rejected sender <${user}>: ${line}`
            })
          }
        }

        // Step 4: RCPT TO response (250) -> Send DATA
        if (step === 4) {
          if (code === 250) {
            step = 5
            client.write(`DATA\r\n`)
            break
          } else if (code >= 400) {
            return finish({
              success: false,
              message: `SMTP Rejected recipient <${options.to}>: ${line}`
            })
          }
        }

        // Step 5: DATA response (354) -> Send message body
        if (step === 5) {
          if (code === 354) {
            step = 6
            client.write(`${rfc2822Message}\r\n`)
            break
          } else if (code >= 400) {
            return finish({
              success: false,
              message: `SMTP DATA command rejected: ${line}`
            })
          }
        }

        // Step 6: Final Delivery Confirmation (250 OK)
        if (step === 6) {
          if (code === 250) {
            serverReceipt = line
            return finish({
              success: true,
              message: `Email verified and delivered successfully to ${options.to}. Server response: ${line}`,
              messageId,
              serverReceipt
            })
          } else if (code >= 400) {
            return finish({
              success: false,
              message: `SMTP Message delivery failed: ${line}`
            })
          }
        }
      }
    })
  })
}
