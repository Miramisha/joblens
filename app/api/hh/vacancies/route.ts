import { env } from 'cloudflare:workers';
import { getUser } from '@/app/auth';
import { mapVacancy, vacancyId } from '@/lib/hh/vacancies';
import { smallJson } from '@/lib/request-body';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function GET(request: Request) {
  if (!(await getUser()))
    return json(
      { error: 'Войдите в JobLens, чтобы искать и добавлять вакансии.' },
      401,
    );
  const params = new URL(request.url).searchParams,
    source = params.get('url'),
    q = params.get('q')?.trim() ?? '',
    page = Number(params.get('page') ?? '0');
  let path: string;
  if (source !== null) {
    const id = vacancyId(source.trim());
    if (!id)
      return json(
        { error: 'Вставьте ссылку вида https://hh.ru/vacancy/123456.' },
        400,
      );
    path = `/vacancies/${id}`;
  } else {
    if (
      q.length < 2 ||
      q.length > 160 ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 99
    )
      return json({ error: 'Введите должность от 2 до 160 символов.' }, 400);
    path =
      '/vacancies?' +
      new URLSearchParams({
        text: q,
        page: String(page),
        per_page: '20',
        order_by: 'publication_time',
      });
  }
  try {
    // Only this fixed API origin is contacted; visitor URLs are never fetched.
    const response = await fetch('https://api.hh.ru' + path, {
      headers: {
        'HH-User-Agent': env.HH_USER_AGENT || 'JobLens/0.1',
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 403 || response.status === 401)
      return json(
        {
          error:
            'hh.ru ограничил доступ к вакансиям. Откройте поиск на hh.ru или заполните карточку вручную.',
          reason: 'access_denied',
        },
        502,
      );
    if (response.status === 404)
      return json({ error: 'Вакансия удалена или недоступна.' }, 404);
    if (response.status === 429)
      return json(
        { error: 'hh.ru просит подождать. Повторите запрос позже.' },
        429,
      );
    if (!response.ok) throw new Error('Provider unavailable');
    const data = (await smallJson(
      new Request('https://local.invalid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: response.body,
        duplex: 'half',
      } as RequestInit),
      2000000,
    )) as Record<string, unknown>;
    if (source !== null) {
      if (data.archived === true)
        return json(
          {
            error: 'Вакансия в архиве. При необходимости добавьте её вручную.',
          },
          410,
        );
      return json({ vacancy: mapVacancy(data) });
    }
    if (
      !Array.isArray(data.items) ||
      typeof data.pages !== 'number' ||
      typeof data.found !== 'number'
    )
      throw new Error('Invalid response');
    return json({
      items: data.items
        .filter((v) => v && typeof v === 'object' && v.archived !== true)
        .map(mapVacancy),
      page,
      pages: Math.min(data.pages, 100),
      found: data.found,
    });
  } catch {
    return json(
      {
        error:
          'Не удалось загрузить вакансии hh.ru. Попробуйте позже или заполните карточку вручную.',
      },
      502,
    );
  }
}
