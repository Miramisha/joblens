import { getDb } from '@/db';
import { authCookie, readCookie } from '@/lib/auth/security';
import { digest, sameOrigin } from '@/lib/hh/security';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return new Response('Недопустимый источник запроса.', { status: 403 });
  const token = readCookie(request.headers.get('cookie'), 'joblens_session');
  const challenge = readCookie(
    request.headers.get('cookie'),
    'joblens_challenge',
  );
  await getDb().batch([
    getDb()
      .prepare('DELETE FROM auth_sessions WHERE token_hash=?')
      .bind(token ? await digest(token) : ''),
    getDb()
      .prepare('UPDATE email_challenges SET consumed=1 WHERE challenge_hash=?')
      .bind(challenge ? await digest(challenge) : ''),
  ]);
  const headers = new Headers({
    Location: '/account',
    'Cache-Control': 'no-store',
  });
  headers.append(
    'Set-Cookie',
    authCookie('joblens_session', '', request.url, 0),
  );
  headers.append(
    'Set-Cookie',
    authCookie('joblens_challenge', '', request.url, 0),
  );
  return new Response(null, { status: 303, headers });
}
