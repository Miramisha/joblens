import { getUser } from '@/app/auth';
import { getDb } from '@/db';
export async function GET() {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  const user = await getUser();
  if (!user)
    return Response.json(
      { error: 'Сначала войдите в JobLens.' },
      { status: 401, headers },
    );
  try {
    const db = getDb();
    // Explicit columns exclude credentials. A batch reads a consistent snapshot.
    const [accounts, jobs, connections] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          'SELECT display_name,skills,created_at FROM accounts WHERE owner_id=?',
        )
        .bind(user.userId),
      db
        .prepare(
          'SELECT payload FROM jobs WHERE owner_id=? ORDER BY updated_at DESC,id',
        )
        .bind(user.userId),
      db
        .prepare(
          'SELECT hh_user_id,display_name,connected_at FROM hh_connections WHERE owner_id=?',
        )
        .bind(user.userId),
    ]);
    const profile = accounts.results[0];
    if (!profile)
      return Response.json(
        { error: 'Аккаунт не найден.' },
        { status: 404, headers },
      );
    const data = {
      format: 'joblens-account-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        email: user.email,
        displayName: profile.display_name,
        skills: profile.skills,
        createdAt: profile.created_at,
      },
      jobs: jobs.results.map((row) => JSON.parse(row.payload as string)),
      connections: connections.results.map((row) => ({
        provider: 'hh.ru',
        userId: row.hh_user_id,
        displayName: row.display_name,
        connectedAt: row.connected_at,
      })),
    };
    return new Response(JSON.stringify(data), {
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="joblens-data-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch {
    return Response.json(
      { error: 'Не удалось подготовить копию данных. Попробуйте ещё раз.' },
      { status: 500, headers },
    );
  }
}
