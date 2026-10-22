import fs from 'fs'
import path from 'path'
import initSqlJs, { Database } from 'sql.js'
import { Conversation, ChatMessage } from '../../shared/types'

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
    }

    this.applyMigrations()
    this.save()
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

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning TEXT,
        timestamp INTEGER NOT NULL
      );
    `)
  }

  public getConversations(): Conversation[] {
    if (!this.db) return []
    const stmt = this.db.prepare(
      'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC'
    )
    const list: Conversation[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const convId = row.id as string
      list.push({
        id: convId,
        title: row.title as string,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        messages: this.getMessages(convId)
      })
    }
    stmt.free()
    return list
  }

  public getMessages(conversationId: string): ChatMessage[] {
    if (!this.db) return []
    const stmt = this.db.prepare(
      'SELECT id, role, content, reasoning, timestamp FROM messages WHERE conversation_id = :id ORDER BY timestamp ASC'
    )
    stmt.bind({ ':id': conversationId })
    const msgs: ChatMessage[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      msgs.push({
        id: row.id as string,
        role: row.role as 'user' | 'assistant',
        content: row.content as string,
        reasoning: (row.reasoning as string) || undefined,
        timestamp: row.timestamp as number
      })
    }
    stmt.free()
    return msgs
  }

  public createConversation(title?: string): Conversation {
    if (!this.db) throw new Error('DB not initialized')
    const id = crypto.randomUUID()
    const now = Date.now()
    const convTitle = title || 'New Conversation'

    this.db.run(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, convTitle, now, now]
    )
    this.save()

    return {
      id,
      title: convTitle,
      createdAt: now,
      updatedAt: now,
      messages: []
    }
  }

  public addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    reasoning?: string
  ): ChatMessage {
    if (!this.db) throw new Error('DB not initialized')
    const id = crypto.randomUUID()
    const now = Date.now()

    this.db.run(
      'INSERT INTO messages (id, conversation_id, role, content, reasoning, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, conversationId, role, content, reasoning || null, now]
    )
    this.db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId])
    this.save()

    return {
      id,
      role,
      content,
      reasoning,
      timestamp: now
    }
  }

  public deleteConversation(id: string): void {
    if (!this.db) return
    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [id])
    this.db.run('DELETE FROM conversations WHERE id = ?', [id])
    this.save()
  }

  public getSetting(key: string): string | null {
    if (!this.db) return null
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = :key')
    stmt.bind({ ':key': key })
    let val: string | null = null
    if (stmt.step()) {
      val = stmt.getAsObject().value as string
    }
    stmt.free()
    return val
  }

  public setSetting(key: string, value: string): void {
    if (!this.db) return
    this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    this.save()
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
