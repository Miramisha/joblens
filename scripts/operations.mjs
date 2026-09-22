import { writeFileSync } from 'node:fs';
const origin = 'https://joblens-career-workspace.pro100macho95.chatgpt.site';
async function request(path, secret) {
  const response = await fetch(origin + path, { method: secret ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000), headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
  if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error(`${path}: expected JSON`);
  return response.json();
}
try {
  if (process.argv[2] === 'backup') {
    if (!process.env.BACKUP_SECRET) throw Error('BACKUP_SECRET missing');
    const data = await request('/api/maintenance/backup', process.env.BACKUP_SECRET);
    if (data.format !== 'joblens-encrypted-backup' || data.version !== 1 || !data.ciphertext || !data.wrappedKey) throw Error('Invalid encrypted backup');
    writeFileSync('joblens-backup.encrypted.json', JSON.stringify(data), { flag: 'wx', mode: 0o600 });
    console.log('Encrypted backup received.');
  } else {
    if (!process.env.MAINTENANCE_SECRET) throw Error('MAINTENANCE_SECRET missing');
    const health = await request('/api/health');
    if (health.status !== 'ok') throw Error('Database health failed');
    const cleanup = await request('/api/maintenance/cleanup', process.env.MAINTENANCE_SECRET);
    if (cleanup.ok !== true) throw Error('Cleanup failed');
    console.log('Database health and expired-record cleanup passed.');
  }
} catch (error) { console.error(error.message?.startsWith('/') ? error.message : 'Operation failed; check configuration and service availability.'); process.exitCode = 1; }
