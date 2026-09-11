import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { getHHSettings } from '@/lib/hh/runtime';
import { authorizeUrl } from '@/lib/hh/client';
import {
  randomSecret,
  digest,
  encrypt,
  sameOrigin,
  cookie,
} from '@/lib/hh/security';
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return new Response('Сначала войдите в JobLens.', { status: 401 });
  if (!sameOrigin(request))
    return new Response('Недопустимый источник запроса.', { status: 403 });
  const config = getHHSettings();
  if (!config)
    return Response.redirect(
      new URL('/account?hh=not_configured', request.url),
      303,
    );
  if (new URL(request.url).origin !== new URL(config.redirectUri).origin)
    return new Response('Подключение доступно на основном адресе JobLens.', {
      status: 400,
    });
  try {
    const db = getDb();
    const account = await db
      .prepare('SELECT owner_id FROM accounts WHERE owner_id = ?')
      .bind(user.userId)
      .first();
    if (!account)
      return Response.redirect(
        new URL('/account?hh=account_required', request.url),
        303,
      );
    const state = randomSecret(),
      verifier = randomSecret(),
      now = Math.floor(Date.now() / 1000);
    const stateHash = await digest(state);
    await db.batch([
      db
        .prepare('UPDATE accounts SET hh_attempt=? WHERE owner_id=?')
        .bind(stateHash, user.userId),
      db
        .prepare(
          'INSERT INTO hh_oauth_states (owner_id,state_hash,encrypted_verifier,expires_at) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET state_hash=excluded.state_hash,encrypted_verifier=excluded.encrypted_verifier,expires_at=excluded.expires_at',
        )
        .bind(
          user.userId,
          stateHash,
          await encrypt(verifier, config.encryptionKey, user.userId),
          now + 600,
        ),
    ]);
    return new Response(null, {
      status: 303,
      headers: {
        Location: authorizeUrl(config, state, await digest(verifier)),
        'Set-Cookie': cookie(state, config.redirectUri),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return Response.redirect(new URL('/account?hh=failed', request.url), 303);
  }
}
