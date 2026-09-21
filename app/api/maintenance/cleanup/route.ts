import { env } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const secret = env.MAINTENANCE_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret))
    return json({ error: 'Очистка по расписанию не настроена.' }, 503);
  const actual = new TextEncoder().encode(request.headers.get('authorization') ?? '');
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return json({ error: 'Доступ запрещён.' }, 401);
  try {
    const now = Math.floor(Date.now() / 1000);
    const db = getDb();
    const results = await db.batch([
      db.prepare('DELETE FROM email_challenges WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM auth_limits WHERE resets_at<=?').bind(now),
      db.prepare('DELETE FROM hh_oauth_states WHERE expires_at<=?').bind(now),
    ]);
    return json({ ok: true, deleted: {
      codes: results[0].meta.changes,
      sessions: results[1].meta.changes,
      limits: results[2].meta.changes,
      oauthStates: results[3].meta.changes,
    } });
  } catch { return json({ error: 'Очистка не выполнена.' }, 500); }
}
