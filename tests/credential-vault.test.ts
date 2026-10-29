import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { CredentialVault } from '../src/main/gateway/credential-vault'

describe('CredentialVault (DPAPI Encrypted Provider Vault)', () => {
  const testUserData = path.resolve(__dirname, '../userData/test-vault')

  beforeEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
    fs.mkdirSync(testUserData, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true })
    }
  })

  it('initializes with default provider metadata', () => {
    const vault = new CredentialVault(testUserData)
    const hubState = vault.getHubState()

    expect(hubState.providers.length).toBeGreaterThanOrEqual(8)
    const gemini = hubState.providers.find((p) => p.id === 'gemini')
    expect(gemini).toBeDefined()
    expect(gemini?.name).toBe('Google Gemini')
    expect(gemini?.getKeyUrl).toContain('aistudio.google.com')
  })

  it('encrypts and stores provider keys securely with masked previews', () => {
    const vault = new CredentialVault(testUserData)
    vault.setKey('gemini', 'AIzaSyTestKey1234567890')

    expect(vault.hasKey('gemini')).toBe(true)
    expect(vault.getKey('gemini')).toBe('AIzaSyTestKey1234567890')

    const preview = vault.getPreview('gemini')
    expect(preview).toBeDefined()
    expect(preview).toBe('AIza••••7890')

    // Verify key is not stored in plaintext on disk
    const vaultFile = path.join(testUserData, 'provider_vault.json')
    expect(fs.existsSync(vaultFile)).toBe(true)
    const raw = fs.readFileSync(vaultFile, 'utf8')
    expect(raw).not.toContain('AIzaSyTestKey1234567890')
  })

  it('supports updating base URLs for custom and Ollama endpoints', () => {
    const vault = new CredentialVault(testUserData)
    vault.setBaseUrl('ollama', 'http://192.168.1.100:11434/v1')
    expect(vault.getBaseUrl('ollama')).toBe('http://192.168.1.100:11434/v1')
  })

  it('persists enable/disable state across vault reloads', () => {
    const vault1 = new CredentialVault(testUserData)
    vault1.setEnabled('anthropic', false)
    expect(vault1.isEnabled('anthropic')).toBe(false)

    // Reload from disk
    const vault2 = new CredentialVault(testUserData)
    expect(vault2.isEnabled('anthropic')).toBe(false)
  })

  it('updates local gateway server settings', () => {
    const vault = new CredentialVault(testUserData)
    vault.updateHubSettings({ localServerEnabled: true, localServerPort: 8080, activeProviderId: 'groq' })

    const hubState = vault.getHubState()
    expect(hubState.localServerEnabled).toBe(true)
    expect(hubState.localServerPort).toBe(8080)
    expect(hubState.activeProviderId).toBe('groq')
  })
})
