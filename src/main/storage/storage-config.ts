import fs from 'fs'
import path from 'path'
import { JarvisDatabase } from './database'

export const STORAGE_CONFIG_FILENAME = 'storage-location.json'
export const SQLITE_FILENAME = 'jarvis.sqlite'

export interface StorageLocationConfig {
  sqliteDir?: string
}

export interface ResolvedDataDirectories {
  configDir: string
  defaultSqliteDir: string
  sqliteDir: string
  dbPath: string
}

export interface RelocateStorageResult {
  sqliteDir: string
  dbPath: string
  mode: 'migrated' | 'loaded_existing' | 'unchanged'
}

/**
 * Reads optional custom SQLite directory override from `%APPDATA%\Jarvis\storage-location.json`.
 */
export function readStorageLocationConfig(configDir: string): StorageLocationConfig {
  const configPath = path.join(configDir, STORAGE_CONFIG_FILENAME)
  if (!fs.existsSync(configPath)) return {}
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as StorageLocationConfig).sqliteDir === 'string'
    ) {
      const trimmed = (parsed as StorageLocationConfig).sqliteDir!.trim()
      return trimmed ? { sqliteDir: path.resolve(trimmed) } : {}
    }
  } catch (err) {
    console.warn('[Jarvis Storage] Failed to read storage-location.json, using default:', err)
  }
  return {}
}

/**
 * Persists custom SQLite folder override atomically, or clears it when `sqliteDir` is null.
 */
export function writeStorageLocationConfig(configDir: string, sqliteDir: string | null): void {
  const configPath = path.join(configDir, STORAGE_CONFIG_FILENAME)
  fs.mkdirSync(configDir, { recursive: true })

  if (!sqliteDir || !sqliteDir.trim()) {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
    return
  }

  const payload = JSON.stringify({ sqliteDir: path.resolve(sqliteDir.trim()) }, null, 2)
  const tmpPath = `${configPath}.${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, payload, 'utf8')
  try {
    fs.renameSync(tmpPath, configPath)
  } catch {
    fs.copyFileSync(tmpPath, configPath)
    try {
      fs.unlinkSync(tmpPath)
    } catch {}
  }
}

/**
 * Resolves bootstrap config directory (`%APPDATA%\Jarvis`), migrates legacy cwd-relative
 * `userData` once if needed, and resolves the effective SQLite directory from `storage-location.json`.
 */
export function resolveInitialDataDirectories(
  appDataDir: string,
  legacyDir?: string
): ResolvedDataDirectories {
  const configDir = path.join(appDataDir, 'Jarvis')
  const alreadyMigrated =
    fs.existsSync(path.join(configDir, SQLITE_FILENAME)) ||
    fs.existsSync(path.join(configDir, 'provider_vault.json'))

  if (
    legacyDir &&
    !alreadyMigrated &&
    fs.existsSync(legacyDir) &&
    path.resolve(legacyDir) !== path.resolve(configDir)
  ) {
    fs.cpSync(legacyDir, configDir, { recursive: true, errorOnExist: false, force: false })
    console.log(`[Jarvis Main] Copied data from ${legacyDir} to ${configDir}`)
  }

  fs.mkdirSync(configDir, { recursive: true })

  const stored = readStorageLocationConfig(configDir)
  let sqliteDir = configDir

  if (stored.sqliteDir) {
    try {
      fs.mkdirSync(stored.sqliteDir, { recursive: true })
      sqliteDir = stored.sqliteDir
    } catch (err) {
      console.warn(
        `[Jarvis Storage] Configured SQLite folder "${stored.sqliteDir}" is inaccessible; falling back to default:`,
        err
      )
      sqliteDir = configDir
    }
  }

  return {
    configDir,
    defaultSqliteDir: configDir,
    sqliteDir,
    dbPath: path.join(sqliteDir, SQLITE_FILENAME)
  }
}

/**
 * Switches or migrates the active `JarvisDatabase` to a new folder (or resets to default when null).
 * - If `<targetDir>/jarvis.sqlite` already exists, switches to it without overwriting existing data.
 * - Otherwise writes the active database atomically to `<targetDir>/jarvis.sqlite` (leaving the old file as backup).
 */
export async function relocateSqliteStorage(
  db: JarvisDatabase,
  configDir: string,
  defaultSqliteDir: string,
  targetDir: string | null
): Promise<RelocateStorageResult> {
  const isReset = !targetDir || !targetDir.trim()
  const resolvedTarget = isReset ? path.resolve(defaultSqliteDir) : path.resolve(targetDir.trim())
  const currentDir = path.resolve(path.dirname(db.getDbPath()))

  if (resolvedTarget.toLowerCase() === currentDir.toLowerCase()) {
    writeStorageLocationConfig(configDir, isReset ? null : resolvedTarget)
    return {
      sqliteDir: currentDir,
      dbPath: db.getDbPath(),
      mode: 'unchanged'
    }
  }

  fs.mkdirSync(resolvedTarget, { recursive: true })

  // Verify the selected folder is actually writable before committing the change
  const probeFile = path.join(
    resolvedTarget,
    `.jarvis-write-probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  )
  fs.writeFileSync(probeFile, '')
  fs.unlinkSync(probeFile)

  const targetDbPath = path.join(resolvedTarget, SQLITE_FILENAME)
  let mode: 'migrated' | 'loaded_existing'

  if (fs.existsSync(targetDbPath)) {
    await db.switchDatabasePath(targetDbPath, 'load_existing')
    mode = 'loaded_existing'
  } else {
    await db.switchDatabasePath(targetDbPath, 'migrate')
    mode = 'migrated'
  }

  const sameAsDefault =
    resolvedTarget.toLowerCase() === path.resolve(defaultSqliteDir).toLowerCase()
  writeStorageLocationConfig(configDir, sameAsDefault ? null : resolvedTarget)

  return {
    sqliteDir: resolvedTarget,
    dbPath: targetDbPath,
    mode
  }
}
