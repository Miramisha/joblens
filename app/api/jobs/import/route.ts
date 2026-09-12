import { getUser } from '@/app/auth';
import { getDb } from '@/db';
import { smallJson } from '@/lib/request-body';
import { sameOrigin, digest } from '@/lib/hh/security';
import { CSV_BYTES, duplicateKey, previewCSV } from '@/lib/job-csv';
import type { Job } from '@/lib/jobs';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function POST(request: Request) {
  const user = await getUser();
  if (!user)
    return json({ error: 'Войдите, чтобы импортировать вакансии.' }, 401);
  if (!sameOrigin(request))
    return json({ error: 'Недопустимый источник запроса.' }, 403);
  let text: string;
  try {
    const data = (await smallJson(request, CSV_BYTES * 2 + 2048)) as {
      csv?: unknown;
    };
    if (typeof data?.csv !== 'string') throw Error('Выберите CSV-файл.');
    text = data.csv;
  } catch {
    return json(
      { error: 'Некорректный файл или превышен размер запроса.' },
      400,
    );
  }
  try {
    const db = getDb();
    const existing = await db
      .prepare('SELECT payload FROM jobs WHERE owner_id=?')
      .bind(user.userId)
      .all<{ payload: string }>();
    let preview;
    try {
      preview = previewCSV(
        text,
        existing.results.map((r) => JSON.parse(r.payload) as Job),
      );
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : 'Некорректный CSV.' },
        400,
      );
    }
    if (preview.some((row) => row.error))
      return json(
        {
          error: 'Исправьте ошибки в файле перед импортом.',
          errors: preview
            .filter((row) => row.error)
            .map(({ row, error }) => ({ row, error })),
        },
        400,
      );
    const inputs = preview
      .filter((row) => row.job && !row.duplicate)
      .map((row) => row.job!);
    if (!inputs.length) return json({ imported: 0, skipped: preview.length });
    const at = new Date().toISOString();
    const jobs = await Promise.all(
      inputs.map(
        async (input): Promise<Job> => ({
          ...input,
          id: 'csv-' + (await digest(user.userId + ':' + duplicateKey(input))),
          revision: 1,
          createdAt: at,
          updatedAt: at,
          history: [
            { at, stage: input.stage, action: 'Вакансия импортирована из CSV' },
          ],
        }),
      ),
    );
    // D1 batch is atomic; deterministic IDs make concurrent/retried imports idempotent.
    const results = await db.batch(
      jobs.map((job) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO jobs (id,owner_id,payload,revision,updated_at) VALUES (?,?,?,?,?)',
          )
          .bind(job.id, user.userId, JSON.stringify(job), 1, at),
      ),
    );
    const imported = results.reduce((sum, r) => sum + r.meta.changes, 0);
    return json({ imported, skipped: preview.length - imported });
  } catch {
    return json(
      {
        error:
          'Не удалось импортировать файл. Повторите попытку: уже сохранённые строки будут пропущены.',
      },
      500,
    );
  }
}
