import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || '');

let schemaInitialized = false;

async function initializeSchema() {
  if (schemaInitialized) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        profile_data TEXT,
        query TEXT,
        mcq_responses TEXT,
        status TEXT DEFAULT 'active'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS uploaded_documents (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        filename TEXT,
        file_path TEXT,
        file_type TEXT,
        extracted_text TEXT,
        extracted_metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS generated_documents (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        file_path TEXT,
        sources TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT,
        chunk_text TEXT,
        embedding BYTEA,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS web_sources (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE,
        domain TEXT,
        title TEXT,
        content TEXT,
        reliability_score REAL,
        source_type TEXT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS moderation_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        event_type TEXT,
        content TEXT,
        blocked INTEGER DEFAULT 0,
        reason TEXT,
        rule_matched TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        event_name TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS source_domains (
        domain TEXT PRIMARY KEY,
        status TEXT,
        reliability_score REAL,
        source_type TEXT,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_session ON uploaded_documents(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_generated_docs_session ON generated_documents(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_moderation_blocked ON moderation_events(blocked)`;

    schemaInitialized = true;
    console.log('✓ Postgres schema initialized');
  } catch (error) {
    console.error('Schema initialization error:', error);
  }
}

export { sql as getDB, initializeSchema };
