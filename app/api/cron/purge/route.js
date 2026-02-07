import { NextResponse } from 'next/server';
import { purgeExpiredSessions } from '@/lib/cleanup';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-cron-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = purgeExpiredSessions();
    
    console.log(`Cron purge executed: ${result.sessionsDeleted} sessions, ${result.filesDeleted} files deleted`);
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron purge error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
