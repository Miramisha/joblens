import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { authCookie, normalizeEmail } from '@/lib/auth/security';
import { digest, sameOrigin } from '@/lib/hh/security';
import { smallJson } from '@/lib/request-body';
const json = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json('Недопустимый источник запроса.', 403);
  const user = await getUser();
  if (!user) return json('Сначала войдите в JobLens.', 401);
  try {
    const data = (await smallJson(request)) as {
      email?: unknown;
      confirmation?: unknown;
    };
    if (
      normalizeEmail(data.email) !== user.email ||
      data.confirmation !== 'DELETE'
    )
      return json('Для подтверждения укажите почту своего аккаунта.', 400);
  } catch {
    return json('Не удалось прочитать подтверждение.', 400);
  }
  try {
    const db = getDb();
    // Remove all related records together; never accept an owner ID from the client.
    await db.batch([
      db.prepare('DELETE FROM jobs WHERE owner_id=?').bind(user.userId),
      db
        .prepare('DELETE FROM hh_oauth_states WHERE owner_id=?')
        .bind(user.userId),
      db
        .prepare('DELETE FROM hh_connections WHERE owner_id=?')
        .bind(user.userId),
      db
        .prepare('DELETE FROM auth_sessions WHERE owner_id=?')
        .bind(user.userId),
      db.prepare('DELETE FROM email_challenges WHERE email=?').bind(user.email),
      db
        .prepare('DELETE FROM auth_limits WHERE bucket=?')
        .bind(`email:${await digest(user.email)}`),
      db.prepare('DELETE FROM accounts WHERE owner_id=?').bind(user.userId),
      db
        .prepare('DELETE FROM email_identities WHERE owner_id=?')
        .bind(user.userId),
    ]);
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    headers.append(
      'Set-Cookie',
      authCookie('joblens_session', '', request.url, 0),
    );
    headers.append(
      'Set-Cookie',
      authCookie('joblens_challenge', '', request.url, 0),
    );
    headers.append(
      'Set-Cookie',
      'joblens_hh_state=; Path=/api/hh/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    );
    return Response.json({ ok: true }, { headers });
  } catch {
    return json('Не удалось удалить аккаунт. Попробуйте ещё раз.', 500);
  }
}
