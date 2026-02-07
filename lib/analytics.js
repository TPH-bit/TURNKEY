import { getDB } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export function trackEvent(sessionId, eventName, metadata = {}) {
  const db = getDB();
  
  try {
    db.prepare(`
      INSERT INTO analytics_events (id, session_id, event_name, metadata)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), sessionId, eventName, JSON.stringify(metadata));
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
}

export function getAnalyticsSummary(startDate, endDate) {
  const db = getDB();
  
  const events = db.prepare(`
    SELECT event_name, COUNT(*) as count
    FROM analytics_events
    WHERE created_at BETWEEN ? AND ?
    GROUP BY event_name
  `).all(startDate, endDate);
  
  const completionRate = db.prepare(`
    SELECT 
      (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE event_name = 'doc_downloaded') * 100.0 /
      (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE event_name = 'start') as rate
  `).get();
  
  return {
    events,
    completionRate: completionRate?.rate || 0
  };
}
