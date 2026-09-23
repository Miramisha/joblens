import { env } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import { allowedLoginEmail } from '@/lib/auth/runtime';
import { parseBackup, BACKUP_LIMIT } from '@/lib/account-backup';
import { encryptBackup } from '@/lib/backup-encryption';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export async function POST(request: Request) {
  const secret = env.BACKUP_SECRET;
  const email = allowedLoginEmail();
  if (
    !secret ||
    !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
    !env.BACKUP_PUBLIC_KEY ||
    !email
  )
    return Response.json(
      { error: 'Backup is not configured' },
      { status: 503, headers },
    );
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const db = getDb();
    // Both queries see one transactional snapshot. Only the configured owner's data.
    const [accounts, jobs] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          'SELECT a.display_name,a.skills,a.created_at FROM accounts a JOIN email_identities i ON i.owner_id=a.owner_id WHERE i.email=?',
        )
        .bind(email),
      db
        .prepare(
          'SELECT j.payload FROM jobs j JOIN email_identities i ON i.owner_id=j.owner_id WHERE i.email=? ORDER BY j.updated_at DESC,j.id',
        )
        .bind(email),
    ]);
    const account = accounts.results[0];
    if (!account)
      return Response.json(
        await encryptBackup(
          {
            format: 'joblens-empty-account-snapshot',
            version: 1,
            exportedAt: new Date().toISOString(),
            reason: 'Owner account does not exist yet',
          },
          env.BACKUP_PUBLIC_KEY,
        ),
        { headers },
      );
    const data = {
      format: 'joblens-account-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        email,
        displayName: account.display_name,
        skills: account.skills,
        createdAt: account.created_at,
      },
      jobs: jobs.results.map((row) => JSON.parse(row.payload as string)),
      connections: [],
    };
    // Refuse to produce an archive that the restore route cannot accept.
    parseBackup(data, email);
    if (new TextEncoder().encode(JSON.stringify(data)).length > BACKUP_LIMIT)
      throw Error('Backup too large');
    return Response.json(await encryptBackup(data, env.BACKUP_PUBLIC_KEY), {
      headers,
    });
  } catch {
    console.error(JSON.stringify({ event: 'scheduled_backup_failed' }));
    return Response.json({ error: 'Backup failed' }, { status: 500, headers });
  }
}
