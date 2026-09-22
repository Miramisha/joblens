import { getDb } from '@/db';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await getDb().prepare('SELECT 1 AS ok').first();
    return Response.json({ status: 'ok' }, { headers });
  } catch {
    const incident = crypto.randomUUID();
    console.error(
      JSON.stringify({ event: 'health_database_failed', incident }),
    );
    return Response.json(
      { status: 'unavailable', incident },
      { status: 503, headers },
    );
  }
}
