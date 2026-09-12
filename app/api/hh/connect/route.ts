import { getUser } from '@/app/auth';
import { sameOrigin } from '@/lib/hh/security';
export async function POST(request: Request) {
  if (!(await getUser()))
    return new Response('Сначала войдите в JobLens.', { status: 401 });
  if (!sameOrigin(request))
    return new Response('Недопустимый источник запроса.', { status: 403 });
  return Response.json(
    {
      error:
        'Поддержка API для соискателей hh.ru прекращена. Добавляйте вакансии на доску через поиск или по ссылке.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
