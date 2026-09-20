import { getDb } from '@/db';
import { getAuthSettings } from '@/lib/auth/runtime';
import {
  authCookie,
  codeHash,
  generateCode,
  normalizeEmail,
} from '@/lib/auth/security';
import { sendCode } from '@/lib/auth/mail';
import { digest, randomSecret, sameOrigin } from '@/lib/hh/security';
import { smallJson } from '@/lib/request-body';
const json = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json('Недопустимый источник запроса.', 403);
  const settings = getAuthSettings();
  if (!settings)
    return json('Отправка писем пока не настроена. Попробуйте позже.', 503);
  let email: string | null;
  try {
    email = normalizeEmail(
      ((await smallJson(request)) as { email?: unknown }).email,
    );
  } catch {
    return json('Укажите корректный email.', 400);
  }
  if (!email) return json('Укажите корректный email.', 400);
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare('DELETE FROM email_challenges WHERE expires_at<=?')
      .bind(now)
      .run();
    // Atomic fixed-window quotas are shared by every Worker instance.
    for (const [bucket, limit] of [
      ['global', 200],
      [`email:${await digest(email)}`, 5],
    ] as const) {
      const allowed = await db
        .prepare(
          `INSERT INTO auth_limits(bucket,count,resets_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END WHERE resets_at<=? OR count<? RETURNING count`,
        )
        .bind(bucket, now + 3600, now, now, now, limit)
        .first();
      if (!allowed)
        return json('Слишком много запросов. Попробуйте через час.', 429);
    }
    const token = randomSecret(),
      hash = await digest(token),
      code = generateCode();
    const reserved = await db
      .prepare(
        `INSERT INTO email_challenges(email,challenge_hash,code_hash,expires_at,sent_at,attempts,consumed) VALUES (?,?,?,?,?,0,1) ON CONFLICT(email) DO UPDATE SET challenge_hash=excluded.challenge_hash,code_hash=excluded.code_hash,expires_at=excluded.expires_at,sent_at=excluded.sent_at,attempts=0,consumed=1 WHERE sent_at<=? RETURNING email`,
      )
      .bind(
        email,
        hash,
        await codeHash(settings.secret, hash, code),
        now + 300,
        now,
        now - 60,
      )
      .first();
    if (!reserved)
      return json(
        'Новый код можно запросить через минуту после предыдущего.',
        429,
      );
    // A failed or timed-out delivery never activates a challenge.
    await sendCode(settings, email, code, hash);
    await db
      .prepare('UPDATE email_challenges SET consumed=0 WHERE challenge_hash=?')
      .bind(hash)
      .run();
    await db.batch([
      db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM email_challenges WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM auth_limits WHERE resets_at<=?').bind(now),
    ]);
    return Response.json(
      { ok: true, retryAfter: 60 },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': authCookie(
            'joblens_challenge',
            token,
            request.url,
            300,
          ),
        },
      },
    );
  } catch {
    return json('Не удалось отправить письмо. Попробуйте через минуту.', 502);
  }
}
