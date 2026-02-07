import { purgeExpiredSessions } from '../lib/cleanup.js';

console.log('Starting automatic purge...');
const result = purgeExpiredSessions();
console.log(`Purge complete: ${result.sessionsDeleted} sessions, ${result.filesDeleted} files deleted`);
process.exit(0);
