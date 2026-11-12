import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { JarvisDatabase } from '../packages/core/src/storage/database'
import {
  SQLITE_FILENAME,
  STORAGE_CONFIG_FILENAME,
  readStorageLocationConfig,
  relocateSqliteStorage,
  resolveInitialDataDirectories,
  writeStorageLocationConfig
} from '../packages/core/src/storage/storage-config'

describe('SQLite Storage Folder Configuration', () => {
  let tempRoot: string
  let appDataDir: string
  let defaultConfigDir: string

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-storage-cfg-'))
    appDataDir = path.join(tempRoot, 'AppData')
    fs.mkdirSync(appDataDir, { recursive: true })
    defaultConfigDir = path.join(appDataDir, 'Jarvis')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {}
  })

  it('defaults to <appData>/Jarvis when no override file exists', () => {
    const dirs = resolveInitialDataDirectories(appDataDir)
    expect(dirs.configDir).toBe(defaultConfigDir)
    expect(dirs.defaultSqliteDir).toBe(defaultConfigDir)
    expect(dirs.sqliteDir).toBe(defaultConfigDir)
    expect(dirs.dbPath).toBe(path.join(defaultConfigDir, SQLITE_FILENAME))
    expect(fs.existsSync(defaultConfigDir)).toBe(true)
  })

  it('uses custom sqliteDir persisted in storage-location.json on startup', () => {
    const customDir = path.join(tempRoot, 'CustomSQLiteFolder')
    writeStorageLocationConfig(defaultConfigDir, customDir)

    const config = readStorageLocationConfig(defaultConfigDir)
    expect(config.sqliteDir).toBe(path.resolve(customDir))

    const dirs = resolveInitialDataDirectories(appDataDir)
    expect(dirs.sqliteDir).toBe(path.resolve(customDir))
    expect(dirs.dbPath).toBe(path.join(path.resolve(customDir), SQLITE_FILENAME))
    expect(fs.existsSync(customDir)).toBe(true)
  })

  it('migrates current SQLite database to a new empty folder and keeps old copy as backup', async () => {
    const dirs = resolveInitialDataDirectories(appDataDir)
    const db = new JarvisDatabase(dirs.dbPath)
    await db.initialize()
    const conv = db.createConversation('Important Chat')
    db.addMessage(conv.id, 'user', 'Keep my history safe!')
    db.setSetting('defaultModel', 'gemini-2.5-pro')

    const targetDir = path.join(tempRoot, 'MovedDB')
    const result = await relocateSqliteStorage(db, dirs.configDir, dirs.defaultSqliteDir, targetDir)

    expect(result.mode).toBe('migrated')
    expect(result.sqliteDir).toBe(path.resolve(targetDir))
    expect(result.dbPath).toBe(path.join(path.resolve(targetDir), SQLITE_FILENAME))
    expect(fs.existsSync(result.dbPath)).toBe(true)
    // Original file retained as backup
    expect(fs.existsSync(dirs.dbPath)).toBe(true)

    // Verify persistence in storage-location.json and data integrity on reopen
    expect(readStorageLocationConfig(dirs.configDir).sqliteDir).toBe(path.resolve(targetDir))

    const reopened = new JarvisDatabase(result.dbPath)
    await reopened.initialize()
    expect(reopened.getSetting('defaultModel')).toBe('gemini-2.5-pro')
    const convs = reopened.getConversations()
    expect(convs.some((c) => c.title === 'Important Chat')).toBe(true)
  })

  it('loads an existing jarvis.sqlite in the selected folder instead of overwriting it', async () => {
    // Prepare pre-existing DB in target folder
    const existingDir = path.join(tempRoot, 'ExistingBackup')
    const existingDbPath = path.join(existingDir, SQLITE_FILENAME)
    const seedDb = new JarvisDatabase(existingDbPath)
    await seedDb.initialize()
    seedDb.createConversation('Recovered Archive')
    seedDb.setSetting('defaultModel', 'groq-llama-3.3')

    // Prepare active default DB with different content
    const dirs = resolveInitialDataDirectories(appDataDir)
    const activeDb = new JarvisDatabase(dirs.dbPath)
    await activeDb.initialize()
    activeDb.createConversation('Current Scratch')

    const result = await relocateSqliteStorage(
      activeDb,
      dirs.configDir,
      dirs.defaultSqliteDir,
      existingDir
    )

    expect(result.mode).toBe('loaded_existing')
    expect(activeDb.getDbPath()).toBe(existingDbPath)
    expect(activeDb.getSetting('defaultModel')).toBe('groq-llama-3.3')
    expect(activeDb.getConversations().some((c) => c.title === 'Recovered Archive')).toBe(true)
  })

  it('resets back to default folder and clears storage-location.json override', async () => {
    const customDir = path.join(tempRoot, 'CustomDir')
    writeStorageLocationConfig(defaultConfigDir, customDir)
    const dirs = resolveInitialDataDirectories(appDataDir)
    const db = new JarvisDatabase(dirs.dbPath)
    await db.initialize()
    db.setSetting('theme', 'light')

    // Remove default sqlite file so reset migrates from customDir back to default
    if (fs.existsSync(path.join(defaultConfigDir, SQLITE_FILENAME))) {
      fs.unlinkSync(path.join(defaultConfigDir, SQLITE_FILENAME))
    }

    const res = await relocateSqliteStorage(db, dirs.configDir, dirs.defaultSqliteDir, null)
    expect(res.mode).toBe('migrated')
    expect(res.sqliteDir).toBe(path.resolve(dirs.defaultSqliteDir))
    expect(fs.existsSync(path.join(dirs.configDir, STORAGE_CONFIG_FILENAME))).toBe(false)
  })

  it('returns unchanged when relocating to the currently active directory', async () => {
    const dirs = resolveInitialDataDirectories(appDataDir)
    const db = new JarvisDatabase(dirs.dbPath)
    await db.initialize()

    const res = await relocateSqliteStorage(
      db,
      dirs.configDir,
      dirs.defaultSqliteDir,
      dirs.sqliteDir
    )
    expect(res.mode).toBe('unchanged')
  })
})
