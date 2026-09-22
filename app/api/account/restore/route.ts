import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { sameOrigin, digest } from '@/lib/hh/security';
import { smallJson } from '@/lib/request-body';
import { parseBackup, BACKUP_LIMIT } from '@/lib/account-backup';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: 'Недопустимый источник запроса.' }, 403);
  const user = await getUser();
  if (!user) return json({ error: 'Сначала войдите.' }, 401);
  let backup;
  try {
    backup = parseBackup(await smallJson(request, BACKUP_LIMIT), user.email);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Некорректная копия.' },
      400,
    );
  }
  try {
    const db = getDb();
    const statements = await Promise.all(
      backup.jobs.map(async (job) => {
        const sourceId = job.id;
        const id = 'restore-' + (await digest(user.userId + ':' + sourceId));
        const restored = { ...job, id };
        return db
          .prepare(
            'INSERT OR IGNORE INTO jobs(id,owner_id,payload,revision,updated_at) SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM accounts WHERE owner_id=?) AND NOT EXISTS(SELECT 1 FROM jobs WHERE owner_id=? AND id=?)',
          )
          .bind(
            id,
            user.userId,
            JSON.stringify(restored),
            job.updatedAt,
            user.userId,
            user.userId,
            sourceId,
          );
      }),
    );
    const results = await db.batch([
      db
        .prepare('UPDATE accounts SET display_name=?,skills=? WHERE owner_id=?')
        .bind(backup.profile.displayName, backup.profile.skills, user.userId),
      ...statements,
    ]);
    const imported = results
      .slice(1)
      .reduce((sum, row) => sum + row.meta.changes, 0);
    return json({ ok: true, imported, skipped: backup.jobs.length - imported });
  } catch {
    console.error('account_restore_failed');
    return json(
      { error: 'Не удалось восстановить копию. Изменения не применены.' },
      500,
    );
  }
}
