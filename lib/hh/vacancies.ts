export type Vacancy = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  description: string;
  skills: string[];
  workFormat: string;
  publishedAt: string;
};
export function vacancyId(value: string): string | null {
  if (/^[1-9]\d{0,14}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      !(u.hostname === 'hh.ru' || u.hostname.endsWith('.hh.ru'))
    )
      return null;
    return /^\/vacancy\/([1-9]\d{0,14})\/?$/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
export function plainDescription(value: unknown): string {
  return text(value, 200000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(?:p|div|ul|ol|li|br|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (match, entity: string) => {
        const entities: Record<string, string> = {
          amp: '&',
          lt: '<',
          gt: '>',
          quot: '"',
          apos: "'",
          nbsp: ' ',
        };
        if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
        const n =
          entity[1].toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : '';
      },
    )
    .replace(/\n[\t ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
}
export function mapVacancy(value: unknown): Vacancy {
  const v = record(value),
    id = text(v.id, 16);
  if (
    !/^[1-9]\d{0,14}$/.test(id) ||
    !text(v.name, 180) ||
    !text(record(v.employer).name, 120)
  )
    throw new Error('Invalid vacancy response');
  if (v.archived === true) throw new Error('Archived vacancy');
  const salary = record(v.salary_range ?? v.salary);
  const amount = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0
      ? new Intl.NumberFormat('ru-RU').format(n)
      : '';
  const from = amount(salary.from),
    to = amount(salary.to);
  const currency = text(salary.currency, 10);
  const units: Record<string, string> = {
    RUR: '₽',
    RUB: '₽',
    USD: '$',
    EUR: '€',
    KZT: '₸',
  };
  const pay =
    from && to ? `${from} – ${to}` : from ? `от ${from}` : to ? `до ${to}` : '';
  const frequency = text(record(salary.mode).name, 30);
  return {
    id,
    title: text(v.name, 180),
    company: text(record(v.employer).name, 120),
    location: text(record(v.area).name, 160),
    salary: pay
      ? `${pay} ${units[currency] ?? currency}${frequency ? ` / ${frequency}` : ''}${salary.gross === true ? ' до налогов' : salary.gross === false ? ' на руки' : ''}`.slice(
          0,
          120,
        )
      : '',
    url: `https://hh.ru/vacancy/${id}`,
    description: plainDescription(v.description),
    workFormat: Array.isArray(v.work_format)
      ? [
          ...new Set(
            v.work_format
              .map((item) => text(record(item).name, 80))
              .filter(Boolean),
          ),
        ]
          .join(', ')
          .slice(0, 240)
      : '',
    publishedAt:
      /^\d{4}-\d{2}-\d{2}T/.test(text(v.published_at, 40)) &&
      Number.isFinite(Date.parse(text(v.published_at, 40)))
        ? new Date(text(v.published_at, 40)).toISOString()
        : '',
    skills: Array.isArray(v.key_skills)
      ? [
          ...new Set(
            v.key_skills.map((k) => text(record(k).name, 60)).filter(Boolean),
          ),
        ].slice(0, 30)
      : [],
  };
}

export function vacancySourceNotes(v: Vacancy): string {
  return [
    v.workFormat ? `Формат работы: ${v.workFormat}` : '',
    v.publishedAt
      ? `Опубликовано на hh.ru: ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(new Date(v.publishedAt))}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
