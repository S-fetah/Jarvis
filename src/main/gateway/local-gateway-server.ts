import http from 'http'
import { ModelBalancer } from './model-balancer'

export class LocalGatewayServer {
  private server: http.Server | null = null
  private balancer: ModelBalancer
  private port = 31415
  private running = false

  constructor(balancer: ModelBalancer) {
    this.balancer = balancer
  }

  public isRunning(): boolean {
    return this.running
  }

  public getPort(): number {
    return this.port
  }

  public async start(port = 31415): Promise<boolean> {
    if (this.running) {
      if (this.port === port) return true
      await this.stop()
    }

    this.port = port

    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS for external tools (Cursor, Continue, Open WebUI, Web browsers)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, *')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        const url = req.url?.split('?')[0] || ''

        // 1. Models Listing: GET /v1/models
        if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
          try {
            const catalog = await this.balancer.listAllModels()
            const modelsData = catalog.all.map((m) => ({
              id: m,
              object: 'model',
              created: Math.floor(Date.now() / 1000),
              owned_by: 'jarvis-gateway'
            }))
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ object: 'list', data: modelsData }))
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: err.message, type: 'server_error' } }))
          }
          return
        }

        // 2. Chat Completions: POST /v1/chat/completions
        if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
          let rawBody = ''
          req.on('data', (chunk) => {
            rawBody += chunk
          })

          req.on('end', async () => {
            try {
              const body = JSON.parse(rawBody || '{}')
              const messages = body.messages || []
              const model = body.model || 'auto'
              const stream = Boolean(body.stream)
              const temperature = body.temperature ?? 0.3
              const tools = body.tools?.map((t: any) => ({
                name: t.function?.name || t.name,
                description: t.function?.description || t.description,
                parameters: t.function?.parameters || t.parameters
              }))

              if (stream) {
                // Server-Sent Events (SSE) Streaming
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                })

                const reqId = `chatcmpl-${Date.now()}`

                await this.balancer.chatStream(
                  messages,
                  (chunk) => {
                    const delta: Record<string, string> = {}
                    if (chunk.type === 'thought') {
                      delta.reasoning_content = chunk.chunk
                    } else {
                      delta.content = chunk.chunk
                    }
                    const payload = {
                      id: reqId,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [{ index: 0, delta, finish_reason: null }]
                    }
                    res.write(`data: ${JSON.stringify(payload)}\n\n`)
                  },
                  { model, temperature }
                )

                // Final done chunk
                const finishPayload = {
                  id: reqId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                }
                res.write(`data: ${JSON.stringify(finishPayload)}\n\n`)
                res.write('data: [DONE]\n\n')
                res.end()
              } else {
                // Non-streaming JSON completion
                const result = await this.balancer.chatWithTools(messages, tools, { model, temperature })
                const responsePayload = {
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: result.activeModel || model,
                  choices: [
                    {
                      index: 0,
                      message: result.message,
                      finish_reason: result.finishReason || 'stop'
                    }
                  ]
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(responsePayload))
              }
            } catch (err: any) {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
              }
              res.end(JSON.stringify({ error: { message: err.message || 'Internal balancer error', type: 'api_error' } }))
            }
          })
          return
        }

        // 3. Fallback: 404
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: `Route not found: ${req.method} ${url}` } }))
      })

      this.server.on('error', (err: any) => {
        console.error(`[LocalGatewayServer] Failed to bind port ${this.port}:`, err)
        this.running = false
        resolve(false)
      })

      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[LocalGatewayServer] Jarvis local OpenAI-compatible gateway running at http://127.0.0.1:${this.port}/v1`)
        this.running = true
        resolve(true)
      })
    })
  }

  public async stop(): Promise<void> {
    if (!this.server || !this.running) return
    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log('[LocalGatewayServer] Stopped local gateway server.')
        this.running = false
        this.server = null
        resolve()
      })
    })
  }
}
