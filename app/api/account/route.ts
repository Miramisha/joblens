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
    const data = (await smallJson(request, 16_384)) as {
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
    // The account is created only by verified login, never by a late save.
    const result =
      skills !== undefined
        ? await getDb()
            .prepare(
              'UPDATE accounts SET display_name=?,skills=? WHERE owner_id=?',
            )
            .bind(name, skills, user.userId)
            .run()
        : await getDb()
            .prepare('UPDATE accounts SET display_name=? WHERE owner_id=?')
            .bind(name, user.userId)
            .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Аккаунт удалён. Войдите снова.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
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
