import { getDB } from './db.js';
import fs from 'fs';

const sql = getDB;

export async function purgeExpiredSessions() {
  const now = new Date().toISOString();
  
  let filesDeleted = 0;
  let sessionsDeleted = 0;
  
  try {
    const expiredSessions = await sql`
      SELECT id FROM sessions WHERE expires_at < ${now}
    `;
    
    for (const session of expiredSessions) {
      const uploadedDocs = await sql`
        SELECT file_path FROM uploaded_documents WHERE session_id = ${session.id}
      `;
      
      for (const doc of uploadedDocs) {
        try {
          if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
            filesDeleted++;
          }
        } catch (error) {
          console.error(`Error deleting file ${doc.file_path}:`, error);
        }
      }
      
      const generatedDocs = await sql`
        SELECT file_path FROM generated_documents WHERE session_id = ${session.id}
      `;
      
      for (const doc of generatedDocs) {
        try {
          if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
            filesDeleted++;
          }
        } catch (error) {
          console.error(`Error deleting file ${doc.file_path}:`, error);
        }
      }
      
      await sql`DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM uploaded_documents WHERE session_id = ${session.id})`;
      await sql`DELETE FROM uploaded_documents WHERE session_id = ${session.id}`;
      await sql`DELETE FROM generated_documents WHERE session_id = ${session.id}`;
      await sql`DELETE FROM moderation_events WHERE session_id = ${session.id}`;
      await sql`DELETE FROM analytics_events WHERE session_id = ${session.id}`;
      await sql`DELETE FROM sessions WHERE id = ${session.id}`;
      
      sessionsDeleted++;
    }
    
    console.log(`Purge complete: ${sessionsDeleted} sessions, ${filesDeleted} files deleted`);
    
    return { sessionsDeleted, filesDeleted };
  } catch (error) {
    console.error('Purge error:', error);
    return { sessionsDeleted, filesDeleted, error: error.message };
  }
}
