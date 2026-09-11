import { headers } from 'next/headers';
import { getDb } from '@/db';
import { digest } from '@/lib/hh/security';
import { readCookie } from '@/lib/auth/security';
export async function getUser() {
  const token = readCookie((await headers()).get('cookie'), 'joblens_session');
  if (!token) return null;
  const row = await getDb()
    .prepare(
      `SELECT i.owner_id, i.email, a.display_name FROM auth_sessions s JOIN email_identities i ON i.owner_id=s.owner_id JOIN accounts a ON a.owner_id=i.owner_id WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .bind(await digest(token), Math.floor(Date.now() / 1000))
    .first<{ owner_id: string; email: string; display_name: string }>();
  return row
    ? { userId: row.owner_id, email: row.email, displayName: row.display_name }
    : null;
}
