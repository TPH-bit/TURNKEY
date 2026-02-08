import { neon } from '@neondatabase/serverless';

// Créer la connexion Neon - elle est lazy et ne se connecte qu'à la première requête
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[DB] ERREUR CRITIQUE: DATABASE_URL non définie!');
}

const sql = neon(DATABASE_URL || '');

let schemaInitialized = false;
let initializationError = null;

async function initializeSchema() {
  // Si déjà initialisé, retourner immédiatement
  if (schemaInitialized) {
    console.log('[DB] Schéma déjà initialisé, skip');
    return;
  }

  // Si une erreur précédente, ne pas réessayer pour éviter les boucles
  if (initializationError) {
    console.log('[DB] Erreur précédente détectée, skip initialisation');
    return;
  }

  console.log('[DB] Début initialisation du schéma...');

  try {
    // Test rapide de connexion
    console.log('[DB] Test de connexion...');
    await sql`SELECT 1 as test`;
    console.log('[DB] Connexion OK');

    // Créer les tables une par une avec logs
    console.log('[DB] Création table sessions...');
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

    console.log('[DB] Création table uploaded_documents...');
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

    console.log('[DB] Création table generated_documents...');
    await sql`
      CREATE TABLE IF NOT EXISTS generated_documents (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        file_path TEXT,
        sources TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('[DB] Création table document_chunks...');
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

    console.log('[DB] Création table web_sources...');
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

    console.log('[DB] Création table moderation_events...');
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

    console.log('[DB] Création table analytics_events...');
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        event_name TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('[DB] Création table admin_users...');
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('[DB] Création table system_config...');
    await sql`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('[DB] Création table source_domains...');
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

    console.log('[DB] Création des index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_session ON uploaded_documents(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_generated_docs_session ON generated_documents(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_moderation_blocked ON moderation_events(blocked)`;

    schemaInitialized = true;
    console.log('[DB] ✓ Schéma Postgres initialisé avec succès');
  } catch (error) {
    initializationError = error;
    console.error('[DB] ERREUR initialisation schéma:', error.message);
    console.error('[DB] Stack:', error.stack);
    // On ne throw pas l'erreur pour permettre à l'app de continuer
    // Les requêtes échoueront individuellement si la DB n'est pas disponible
  }
}

export { sql as getDB, initializeSchema };
