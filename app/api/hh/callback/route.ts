import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { getHHSettings } from '@/lib/hh/runtime';
import { exchangeCode, currentProfile, HHError } from '@/lib/hh/client';
import {
  stateCookie,
  digest,
  decrypt,
  encrypt,
  cookie,
} from '@/lib/hh/security';
export async function GET(request: Request) {
  const config = getHHSettings(),
    url = new URL(request.url);
  const finish = (result: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: new URL(`/account?hh=${result}`, url.origin).toString(),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Set-Cookie': cookie('', config?.redirectUri ?? request.url, 0),
      },
    });
  if (!config) return finish('not_configured');
  const user = await getUser();
  if (!user) return finish('login_required');
  const state = url.searchParams.get('state');
  if (
    !state ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    stateCookie(request) !== state
  )
    return finish('invalid_state');
  try {
    const db = getDb();
    // Atomic consumption prevents replay and binds this attempt to the signed-in owner.
    const row = await db
      .prepare(
        'DELETE FROM hh_oauth_states WHERE owner_id=? AND state_hash=? AND expires_at>? RETURNING encrypted_verifier',
      )
      .bind(user.userId, await digest(state), Math.floor(Date.now() / 1000))
      .first<{ encrypted_verifier: string }>();
    if (!row) return finish('invalid_state');
    if (url.searchParams.has('error')) return finish('denied');
    const code = url.searchParams.get('code');
    if (!code || code.length > 4096) return finish('failed');
    const tokens = await exchangeCode(
      config,
      code,
      await decrypt(row.encrypted_verifier, config.encryptionKey, user.userId),
    );
    const profile = await currentProfile(config, tokens.accessToken);
    const existing = await db
      .prepare(
        'SELECT owner_id FROM hh_connections WHERE hh_user_id=? AND owner_id<>?',
      )
      .bind(profile.id, user.userId)
      .first();
    if (existing) return finish('already_linked');
    const encrypted = await encrypt(
      JSON.stringify(tokens),
      config.encryptionKey,
      user.userId,
    );
    const result = await db
      .prepare(
        'INSERT INTO hh_connections (owner_id,hh_user_id,display_name,encrypted_tokens,expires_at,connected_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM accounts WHERE owner_id=? AND hh_attempt=?) ON CONFLICT(owner_id) DO UPDATE SET hh_user_id=excluded.hh_user_id,display_name=excluded.display_name,encrypted_tokens=excluded.encrypted_tokens,expires_at=excluded.expires_at,connected_at=excluded.connected_at',
      )
      .bind(
        user.userId,
        profile.id,
        profile.displayName,
        encrypted,
        tokens.expiresAt,
        new Date().toISOString(),
        user.userId,
        await digest(state),
      )
      .run();
    if (!result.meta.changes) return finish('invalid_state');
    return finish('connected');
  } catch (e) {
    return finish(
      e instanceof HHError && e.kind === 'not_applicant'
        ? 'not_applicant'
        : 'failed',
    );
  }
}
