import { getDB } from './db.js';
import fs from 'fs';
import path from 'path';

export function purgeExpiredSessions() {
  const db = getDB();
  const now = new Date().toISOString();
  
  const expiredSessions = db.prepare(`
    SELECT id FROM sessions WHERE expires_at < ?
  `).all(now);
  
  let filesDeleted = 0;
  let sessionsDeleted = 0;
  
  for (const session of expiredSessions) {
    const uploadedDocs = db.prepare(`
      SELECT file_path FROM uploaded_documents WHERE session_id = ?
    `).all(session.id);
    
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
    
    const generatedDocs = db.prepare(`
      SELECT file_path FROM generated_documents WHERE session_id = ?
    `).all(session.id);
    
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
    
    db.prepare('DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM uploaded_documents WHERE session_id = ?)').run(session.id);
    db.prepare('DELETE FROM uploaded_documents WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM generated_documents WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM moderation_events WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM analytics_events WHERE session_id = ?').run(session.id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    
    sessionsDeleted++;
  }
  
  console.log(`Purge complete: ${sessionsDeleted} sessions, ${filesDeleted} files deleted`);
  
  return { sessionsDeleted, filesDeleted };
}
