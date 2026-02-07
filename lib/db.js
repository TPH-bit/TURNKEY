import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'turnkey.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const db = getDB();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      profile_data TEXT,
      query TEXT,
      mcq_responses TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_documents (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      filename TEXT,
      file_path TEXT,
      file_type TEXT,
      extracted_text TEXT,
      extracted_metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_documents (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      file_path TEXT,
      sources TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      chunk_text TEXT,
      embedding BLOB,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES uploaded_documents(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS web_sources (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE,
      domain TEXT,
      title TEXT,
      content TEXT,
      reliability_score REAL,
      source_type TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS moderation_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      event_type TEXT,
      content TEXT,
      blocked INTEGER DEFAULT 0,
      reason TEXT,
      rule_matched TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      event_name TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'analyst',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS source_domains (
      domain TEXT PRIMARY KEY,
      status TEXT,
      reliability_score REAL,
      source_type TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_uploaded_docs_session ON uploaded_documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_generated_docs_session ON generated_documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_moderation_blocked ON moderation_events(blocked);
  `);

  console.log('✓ Database schema initialized');
}

export { getDB, initializeSchema };
