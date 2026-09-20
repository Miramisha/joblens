import { getDb } from '@/db';
import { getAuthSettings } from '@/lib/auth/runtime';
import { authCookie, codeHash, readCookie } from '@/lib/auth/security';
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
  if (!settings) return json('Вход по почте пока не настроен.', 503);
  let code: unknown;
  try {
    code = ((await smallJson(request)) as { code?: unknown }).code;
  } catch {
    return json('Введите шестизначный код.', 400);
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code))
    return json('Введите шестизначный код.', 400);
  const token = readCookie(request.headers.get('cookie'), 'joblens_challenge');
  if (!token) return json('Запросите новый код в этом браузере.', 400);
  try {
    const db = getDb(),
      now = Math.floor(Date.now() / 1000),
      challenge = await digest(token);
    // D1 batch is transactional: charge the attempt and delete the successful
    // challenge together, so concurrent requests cannot reuse it.
    const [, , deleted] = await db.batch([
      db.prepare('DELETE FROM email_challenges WHERE expires_at<=?').bind(now),
      db
        .prepare(
          `UPDATE email_challenges SET attempts=attempts+1,consumed=CASE WHEN code_hash=? THEN 1 ELSE 0 END WHERE challenge_hash=? AND consumed=0 AND attempts<5 AND expires_at>?`,
        )
        .bind(await codeHash(settings.secret, challenge, code), challenge, now),
      db
        .prepare(
          'DELETE FROM email_challenges WHERE challenge_hash=? AND consumed=1 AND attempts>0 AND expires_at>? RETURNING email',
        )
        .bind(challenge, now),
      db
        .prepare(
          'DELETE FROM email_challenges WHERE challenge_hash=? AND attempts>=5',
        )
        .bind(challenge),
    ]);
    const result = deleted.results[0] as { email: string } | undefined;
    if (!result)
      return json(
        'Код неверный, истёк или исчерпаны 5 попыток. Проверьте код или запросите новый.',
        400,
      );
    const session = randomSecret();
    const old = readCookie(request.headers.get('cookie'), 'joblens_session');
    await db.batch([
      db
        .prepare(
          'INSERT INTO email_identities(email,owner_id,verified_at) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING',
        )
        .bind(result.email, crypto.randomUUID(), now),
      db
        .prepare(
          'INSERT INTO accounts(owner_id,display_name,created_at) SELECT owner_id,?,? FROM email_identities WHERE email=? ON CONFLICT(owner_id) DO NOTHING',
        )
        .bind(
          result.email.split('@')[0].slice(0, 80),
          new Date().toISOString(),
          result.email,
        ),
      db
        .prepare(
          'INSERT INTO auth_sessions(token_hash,owner_id,expires_at) SELECT ?,owner_id,? FROM email_identities WHERE email=?',
        )
        .bind(await digest(session), now + 60 * 60 * 24 * 30, result.email),
      db
        .prepare('DELETE FROM auth_sessions WHERE token_hash=?')
        .bind(old ? await digest(old) : ''),
    ]);
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    headers.append(
      'Set-Cookie',
      authCookie('joblens_session', session, request.url, 60 * 60 * 24 * 30),
    );
    headers.append(
      'Set-Cookie',
      authCookie('joblens_challenge', '', request.url, 0),
    );
    return Response.json({ ok: true }, { headers });
  } catch {
    return json('Не удалось завершить вход. Запросите новый код.', 500);
  }
}
