import fs from 'fs'
import path from 'path'
import initSqlJs, { Database } from 'sql.js'

export class JarvisDatabase {
  private db: Database | null = null
  private dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  public async initialize(): Promise<void> {
    const SQL = await initSqlJs()

    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
      this.applyMigrations()
      this.save()
    }
  }

  private applyMigrations(): void {
    if (!this.db) return

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        workspace_path TEXT NOT NULL,
        active_model TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        category TEXT NOT NULL,
        arguments_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        details TEXT,
        category TEXT,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  public save(): void {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(this.dbPath, buffer)
  }

  public getRawDb(): Database {
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }
}
