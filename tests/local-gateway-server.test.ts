import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { CredentialVault } from '../src/main/gateway/credential-vault'
import { ModelBalancer } from '../src/main/gateway/model-balancer'
import { LocalGatewayServer } from '../src/main/gateway/local-gateway-server'

describe('LocalGatewayServer (Embedded OpenAI-Compatible Gateway)', () => {
  const testUserData = path.resolve(__dirname, '../userData/test-server')
  const testPort = 39415
  let vault: CredentialVault
  let balancer: ModelBalancer
  let server: LocalGatewayServer

  beforeAll(async () => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
    fs.mkdirSync(testUserData, { recursive: true })
    vault = new CredentialVault(testUserData)
    balancer = new ModelBalancer(vault)
    server = new LocalGatewayServer(balancer)
    await server.start(testPort)
  })

  afterAll(async () => {
    await server.stop()
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
  })

  it('binds to localhost and responds to GET /v1/models with standard OpenAI format', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/models`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    expect(json.object).toBe('list')
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)

    const modelIds = json.data.map((m: any) => m.id)
    expect(modelIds).toContain('auto')
  })

  it('sets CORS headers allowing external tool integration', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/models`, {
      method: 'OPTIONS'
    })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('stops cleanly and releases port', async () => {
    expect(server.isRunning()).toBe(true)
    await server.stop()
    expect(server.isRunning()).toBe(false)

    // Re-verify port can be bound again
    const restarted = await server.start(testPort)
    expect(restarted).toBe(true)
  })
})
