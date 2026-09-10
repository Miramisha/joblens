import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { sameOrigin, decrypt } from '@/lib/hh/security';
import { getHHSettings } from '@/lib/hh/runtime';
import { revokeToken, type HHTokens } from '@/lib/hh/client';
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response('Войдите в JobLens.', { status: 401 });
  if (!sameOrigin(request))
    return new Response('Недопустимый источник запроса.', { status: 403 });
  try {
    const db = getDb();
    const result = await db.batch([
      db
        .prepare('UPDATE accounts SET hh_attempt=NULL WHERE owner_id=?')
        .bind(user.userId),
      db
        .prepare(
          'DELETE FROM hh_connections WHERE owner_id=? RETURNING encrypted_tokens',
        )
        .bind(user.userId),
      db
        .prepare('DELETE FROM hh_oauth_states WHERE owner_id=?')
        .bind(user.userId),
    ]);
    const removed = result[1].results[0] as
      | { encrypted_tokens: string }
      | undefined;
    let revoked = !removed;
    const config = getHHSettings();
    if (removed && config) {
      try {
        const tokens = JSON.parse(
          await decrypt(
            removed.encrypted_tokens,
            config.encryptionKey,
            user.userId,
          ),
        ) as HHTokens;
        revoked = await revokeToken(config, tokens.accessToken);
      } catch {
        revoked = false;
      }
    }
    return Response.redirect(
      new URL(
        `/account?hh=${revoked ? 'disconnected' : 'disconnected_local'}`,
        request.url,
      ),
      303,
    );
  } catch {
    return Response.redirect(new URL('/account?hh=failed', request.url), 303);
  }
}
