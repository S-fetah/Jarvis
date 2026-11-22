import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JarvisDatabase } from '../packages/core/src/storage/database'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Conversation Rename Feature', () => {
  let tmpDir: string
  let db: JarvisDatabase

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `jarvis-test-conv-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    const dbFile = path.join(tmpDir, 'test.sqlite')
    db = new JarvisDatabase(dbFile)
    await db.initialize()
  })

  it('creates, renames, and verifies conversation title updates in database', () => {
    const conv = db.createConversation('Original Title')
    expect(conv.title).toBe('Original Title')

    const success = db.renameConversation(conv.id, 'Renamed J.A.R.V.I.S. Project')
    expect(success).toBe(true)

    const list = db.getConversations()
    const updated = list.find((c) => c.id === conv.id)
    expect(updated).toBeDefined()
    expect(updated?.title).toBe('Renamed J.A.R.V.I.S. Project')
  })

  it('falls back to default title when renamed to empty whitespace', () => {
    const conv = db.createConversation('Initial Chat')
    const success = db.renameConversation(conv.id, '   ')
    expect(success).toBe(true)

    const list = db.getConversations()
    const updated = list.find((c) => c.id === conv.id)
    expect(updated?.title).toBe('Conversation')
  })

  it('returns false when renaming non-existent conversation in uninitialized db', () => {
    const uninitDb = new JarvisDatabase(path.join(tmpDir, 'uninit.sqlite'))
    const success = uninitDb.renameConversation('non-existent-id', 'New Title')
    expect(success).toBe(false)
  })
})
