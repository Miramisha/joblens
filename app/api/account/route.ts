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
  let skills: string | undefined;
  try {
    const data = (await smallJson(request)) as {
      displayName?: unknown;
      skills?: unknown;
    };
    if (
      typeof data.displayName !== 'string' ||
      !data.displayName.trim() ||
      data.displayName.trim().length > 80
    )
      throw Error();
    name = data.displayName.trim();
    if (data.skills !== undefined) {
      if (typeof data.skills !== 'string' || data.skills.length > 1800)
        throw Error();
      skills = [
        ...new Set(
          data.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ].join(', ');
    }
  } catch {
    return Response.json(
      {
        error:
          'Укажите имя от 1 до 80 символов и навыки не длиннее 1800 символов.',
      },
      { status: 400 },
    );
  }
  try {
    if (skills !== undefined) {
      await getDb()
        .prepare(
          'INSERT INTO accounts (owner_id, display_name, skills, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET display_name = excluded.display_name, skills = excluded.skills',
        )
        .bind(user.userId, name, skills, new Date().toISOString())
        .run();
    } else
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
