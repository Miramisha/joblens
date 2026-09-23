import { duplicateKey } from '@/lib/job-csv';
import { storageLimit, STORAGE_LIMIT_MESSAGE } from '@/lib/storage-budget';
import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { blank, validateJob, type Job } from '@/lib/jobs';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
async function run(
  request: Request,
  write: boolean,
  action: (owner: string) => Promise<Response>,
) {
  const user = await getUser();
  if (!user)
    return json(
      { error: 'Войдите, чтобы работать с личными вакансиями.' },
      401,
    );
  if (write) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin)
      return json({ error: 'Недопустимый источник запроса.' }, 403);
  }
  try {
    return await action(user.userId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('joblens_owner_deleted') ||
        String(error.cause).includes('joblens_owner_deleted'))
    )
      return json({ error: 'Аккаунт удалён. Войдите снова.' }, 401);
    if (storageLimit(error)) return json({ error: STORAGE_LIMIT_MESSAGE }, 413);
    console.error(
      'JobLens request failed',
      error instanceof Error ? error.message : 'unknown',
    );
    return json(
      { error: 'Не удалось обратиться к базе. Попробуйте ещё раз.' },
      500,
    );
  }
}
async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw Error('Ожидается JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Пустой запрос.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    // Includes UTF-8 and JSON escaping for every accepted field.
    if (size > 250000) {
      await reader.cancel();
      throw Error('Слишком большой запрос.');
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function GET(request: Request) {
  return run(request, false, async (owner) => {
    const result = await getDb()
      .prepare(
        'SELECT payload FROM jobs WHERE owner_id = ? ORDER BY updated_at DESC',
      )
      .bind(owner)
      .all<{ payload: string }>();
    return json({
      jobs: result.results.map((r) => ({ ...blank, ...JSON.parse(r.payload) })),
    });
  });
}
export async function POST(request: Request) {
  return run(request, true, async (owner) => {
    let input;
    try {
      input = validateJob(await body(request));
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : 'Некорректный запрос.' },
        400,
      );
    }
    const at = new Date().toISOString();
    const job: Job = {
      ...input,
      id: crypto.randomUUID(),
      revision: 1,
      createdAt: at,
      updatedAt: at,
      history: [{ at, stage: input.stage, action: 'Вакансия добавлена' }],
    };
    await getDb()
      .prepare(
        'INSERT INTO jobs (id, owner_id, payload, revision, updated_at, duplicate_key) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(job.id, owner, JSON.stringify(job), 1, at, duplicateKey(job))
      .run();
    return json({ job }, 201);
  });
}
export async function PUT(request: Request) {
  return run(request, true, async (owner) => {
    let input, raw;
    try {
      raw = await body(request);
      input = validateJob(raw);
      if (typeof raw.id !== 'string' || !Number.isInteger(raw.revision))
        throw Error('Некорректная версия вакансии.');
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : 'Некорректный запрос.' },
        400,
      );
    }
    const db = getDb();
    const row = await db
      .prepare('SELECT payload FROM jobs WHERE id = ? AND owner_id = ?')
      .bind(raw.id, owner)
      .first<{ payload: string }>();
    if (!row) return json({ error: 'Вакансия не найдена.' }, 404);
    const old: Job = { ...blank, ...JSON.parse(row.payload) };
    if (old.revision !== raw.revision)
      return json(
        {
          error:
            'Вакансия уже изменена. Обновите доску и откройте карточку заново.',
        },
        409,
      );
    const at = new Date().toISOString();
    const job: Job = {
      ...old,
      ...input,
      revision: old.revision + 1,
      updatedAt: at,
      history: [
        ...old.history,
        {
          at,
          stage: input.stage,
          action:
            old.stage === input.stage ? 'Карточка обновлена' : 'Этап изменён',
        },
      ],
    };
    const result = await db
      .prepare(
        'UPDATE jobs SET payload = ?, revision = ?, updated_at = ?, duplicate_key = ? WHERE id = ? AND owner_id = ? AND revision = ?',
      )
      .bind(
        JSON.stringify(job),
        job.revision,
        at,
        duplicateKey(job),
        old.id,
        owner,
        old.revision,
      )
      .run();
    if (!result.meta.changes)
      return json({ error: 'Вакансия уже изменена. Обновите доску.' }, 409);
    return json({ job });
  });
}
export async function DELETE(request: Request) {
  return run(request, true, async (owner) => {
    let raw;
    try {
      raw = await body(request);
      if (typeof raw.id !== 'string' || !Number.isInteger(raw.revision))
        throw Error('Некорректный запрос.');
    } catch {
      return json({ error: 'Некорректный запрос.' }, 400);
    }
    const result = await getDb()
      .prepare(
        'DELETE FROM jobs WHERE id = ? AND owner_id = ? AND revision = ?',
      )
      .bind(raw.id, owner, raw.revision)
      .run();
    return result.meta.changes
      ? json({ ok: true })
      : json({ error: 'Вакансия удалена или изменена. Обновите доску.' }, 409);
  });
}
