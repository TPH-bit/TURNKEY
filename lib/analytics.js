import { getDB } from './db.js';
import { v4 as uuidv4 } from 'uuid';

const sql = getDB;

export async function trackEvent(sessionId, eventName, metadata = {}) {
  try {
    await sql`
      INSERT INTO analytics_events (id, session_id, event_name, metadata)
      VALUES (${uuidv4()}, ${sessionId}, ${eventName}, ${JSON.stringify(metadata)})
    `;
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
}

export async function getAnalyticsSummary(startDate, endDate) {
  try {
    const events = await sql`
      SELECT event_name, COUNT(*) as count
      FROM analytics_events
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY event_name
    `;
    
    const completionRateResult = await sql`
      SELECT 
        (SELECT COUNT(DISTINCT session_id)::float FROM analytics_events WHERE event_name = 'doc_downloaded') * 100.0 /
        NULLIF((SELECT COUNT(DISTINCT session_id)::float FROM analytics_events WHERE event_name = 'start'), 0) as rate
    `;
    
    return {
      events: events.map(e => ({ event_name: e.event_name, count: parseInt(e.count) })),
      completionRate: completionRateResult[0]?.rate || 0
    };
  } catch (error) {
    console.error('Analytics summary error:', error);
    return { events: [], completionRate: 0 };
  }
}
