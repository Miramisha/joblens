import { smallJson } from '@/lib/request-body';
import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { sameOrigin } from '@/lib/hh/security';
export async function POST(request: Request) {
  const user = await getUser();
  if (!user)
    return Response.json(
      { error: 'Сначала войдите в JobLens.' },
      { status: 401 },
    );
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Недопустимый источник запроса.' },
      { status: 403 },
    );
  let name: string;
  try {
    const data = (await smallJson(request)) as { displayName?: unknown };
    if (
      typeof data.displayName !== 'string' ||
      !data.displayName.trim() ||
      data.displayName.trim().length > 80
    )
      throw Error();
    name = data.displayName.trim();
  } catch {
    return Response.json(
      { error: 'Укажите имя длиной от 1 до 80 символов.' },
      { status: 400 },
    );
  }
  try {
    await getDb()
      .prepare(
        'INSERT INTO accounts (owner_id, display_name, created_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET display_name = excluded.display_name',
      )
      .bind(user.userId, name, new Date().toISOString())
      .run();
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'Не удалось сохранить профиль. Попробуйте ещё раз.' },
      { status: 500 },
    );
  }
}
