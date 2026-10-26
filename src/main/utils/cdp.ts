/**
 * Lightweight, zero-dependency Chrome DevTools Protocol (CDP) client.
 * Uses native Node fetch and WebSocket to communicate directly with Google Chrome's
 * remote debugging endpoint without requiring bloated external binaries.
 */

export interface CdpTarget {
  id: string
  title: string
  url: string
  type: string
  description?: string
  webSocketDebuggerUrl?: string
  devtoolsFrontendUrl?: string
}

export interface PageInspectionResult {
  targetId: string
  title: string
  url: string
  headings: string[]
  textContent: string
  links: Array<{ text: string; href: string }>
  interactiveElements: Array<{ tag: string; type?: string; text?: string; ariaLabel?: string; id?: string }>
}

export interface DomClickResult {
  success: boolean
  message: string
  targetId: string
  selector: string
}

export interface PageScrollResult {
  success: boolean
  scrollX: number
  scrollY: number
  targetId: string
}

/**
 * Checks whether Chrome's remote debugging CDP endpoint is active and responding.
 */
export async function isCdpAvailable(port = 9222): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1200)
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Lists all active Chrome targets (filtered to page/tab targets).
 */
export async function listCdpTargets(port = 9222): Promise<CdpTarget[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return []
    const targets = (await res.json()) as CdpTarget[]
    return targets.filter((t) => t.type === 'page')
  } catch {
    return []
  }
}

/**
 * Opens a new tab in Chrome with the specified URL via CDP.
 */
export async function createCdpTab(url: string, port = 9222): Promise<CdpTarget | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(4000)
    })
    if (!res.ok) return null
    return (await res.json()) as CdpTarget
  } catch {
    return null
  }
}

/**
 * Deterministically closes a specific Chrome tab target by ID.
 */
export async function closeCdpTarget(targetId: string, port = 9222): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000)
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Focuses / activates a specific Chrome tab target by ID.
 */
export async function activateCdpTarget(targetId: string, port = 9222): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/activate/${targetId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000)
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Dispatches a raw JSON-RPC command over WebSocket to a Chrome CDP target.
 */
export async function sendCdpCommand<T = any>(
  targetWsUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket
    try {
      ws = new WebSocket(targetWsUrl)
    } catch (err: any) {
      return reject(new Error(`Failed to connect to CDP WebSocket (${targetWsUrl}): ${err.message}`))
    }

    const cmdId = Math.floor(Math.random() * 1000000)
    const timeout = setTimeout(() => {
      try {
        ws.close()
      } catch {}
      reject(new Error(`CDP command '${method}' timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    ws.onopen = () => {
      try {
        const payload = JSON.stringify({ id: cmdId, method, params })
        ws.send(payload)
      } catch (err: any) {
        clearTimeout(timeout)
        try {
          ws.close()
        } catch {}
        reject(new Error(`Failed to send CDP message: ${err.message}`))
      }
    }

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString()
        const msg = JSON.parse(raw)
        if (msg.id === cmdId) {
          clearTimeout(timeout)
          try {
            ws.close()
          } catch {}
          if (msg.error) {
            reject(new Error(`CDP Error in ${method}: ${msg.error.message || JSON.stringify(msg.error)}`))
          } else {
            resolve(msg.result as T)
          }
        }
      } catch {
        // Ignore unparseable or irrelevant background events
      }
    }

    ws.onerror = (err: any) => {
      clearTimeout(timeout)
      reject(new Error(`CDP WebSocket error on ${method}: ${err.message || String(err)}`))
    }
  })
}

/**
 * Evaluates a JavaScript expression within the DOM context of a target tab and returns the value.
 */
export async function evaluateInTarget<T = any>(
  target: CdpTarget,
  expression: string,
  timeoutMs = 10000
): Promise<T> {
  if (!target.webSocketDebuggerUrl) {
    throw new Error(`Target '${target.title || target.id}' does not have a webSocketDebuggerUrl.`)
  }

  const result = await sendCdpCommand<{ result: { value: T; description?: string } }>(
    target.webSocketDebuggerUrl,
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true
    },
    timeoutMs
  )

  return result.result?.value
}

/**
 * Resolves the primary or matching page target on the local CDP port.
 */
export async function resolveTarget(
  targetIdOrUrl?: string,
  port = 9222
): Promise<CdpTarget> {
  const targets = await listCdpTargets(port)
  if (targets.length === 0) {
    throw new Error(`No active Chrome page targets found on port ${port}. Ensure Chrome is running with --remote-debugging-port=${port}.`)
  }

  if (!targetIdOrUrl) {
    // Default to the first page target
    return targets[0]
  }

  const matched = targets.find(
    (t) =>
      t.id === targetIdOrUrl ||
      t.url.toLowerCase().includes(targetIdOrUrl.toLowerCase()) ||
      t.title.toLowerCase().includes(targetIdOrUrl.toLowerCase())
  )

  if (!matched) {
    throw new Error(`No Chrome tab matching '${targetIdOrUrl}' found. Open tabs: ${targets.map((t) => `"${t.title}" (${t.id})`).join(', ')}`)
  }

  return matched
}

/**
 * Deeply inspects a webpage DOM, extracting headings, readable body text, top links, and interactive elements.
 */
export async function inspectPageContent(
  targetIdOrUrl?: string,
  port = 9222
): Promise<PageInspectionResult> {
  const target = await resolveTarget(targetIdOrUrl, port)

  const inspectionScript = `
    (() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
        .map(h => h.innerText.trim())
        .filter(Boolean)
        .slice(0, 30);

      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }))
        .filter(l => l.text && l.href.startsWith('http'))
        .slice(0, 35);

      const interactive = Array.from(document.querySelectorAll('button, input, select, textarea, [role="button"]'))
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.type,
          text: el.innerText ? el.innerText.trim().slice(0, 50) : undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          id: el.id || undefined
        }))
        .filter(el => el.text || el.ariaLabel || el.id)
        .slice(0, 40);

      const bodyText = (document.body ? document.body.innerText : '')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, 4000);

      return {
        headings,
        links,
        interactiveElements: interactive,
        textContent: bodyText
      };
    })()
  `

  const extracted = await evaluateInTarget<{
    headings: string[]
    links: Array<{ text: string; href: string }>
    interactiveElements: Array<{ tag: string; type?: string; text?: string; ariaLabel?: string; id?: string }>
    textContent: string
  }>(target, inspectionScript)

  return {
    targetId: target.id,
    title: target.title,
    url: target.url,
    headings: extracted?.headings || [],
    textContent: extracted?.textContent || '',
    links: extracted?.links || [],
    interactiveElements: extracted?.interactiveElements || []
  }
}

/**
 * Clicks a DOM element matching a CSS selector with verification.
 */
export async function clickDomElement(
  selector: string,
  targetIdOrUrl?: string,
  port = 9222
): Promise<DomClickResult> {
  const target = await resolveTarget(targetIdOrUrl, port)

  const clickScript = `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) {
        return { found: false, message: "Element matching selector not found." };
      }
      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return { found: true, message: "Clicked successfully." };
      } catch (err) {
        return { found: true, error: err.message };
      }
    })()
  `

  const res = await evaluateInTarget<{ found: boolean; message?: string; error?: string }>(target, clickScript)

  if (!res?.found) {
    return {
      success: false,
      message: `Element matching '${selector}' was not found on page '${target.title}' (${target.url}).`,
      targetId: target.id,
      selector
    }
  }

  if (res.error) {
    return {
      success: false,
      message: `Failed to click '${selector}': ${res.error}`,
      targetId: target.id,
      selector
    }
  }

  return {
    success: true,
    message: `Successfully clicked element matching '${selector}' on '${target.title}'.`,
    targetId: target.id,
    selector
  }
}

/**
 * Scrolls the active or specified webpage.
 */
export async function scrollPageContent(
  distanceY: number,
  distanceX = 0,
  targetIdOrUrl?: string,
  port = 9222
): Promise<PageScrollResult> {
  const target = await resolveTarget(targetIdOrUrl, port)

  const scrollScript = `
    (() => {
      window.scrollBy(${distanceX}, ${distanceY});
      return { scrollX: window.scrollX, scrollY: window.scrollY };
    })()
  `

  const coords = await evaluateInTarget<{ scrollX: number; scrollY: number }>(target, scrollScript)

  return {
    success: true,
    scrollX: coords?.scrollX ?? 0,
    scrollY: coords?.scrollY ?? distanceY,
    targetId: target.id
  }
}
