import { blank, labels, stages, validateJob, type JobInput } from './jobs.ts';
export const CSV_LIMIT = 100;
export const CSV_BYTES = 2_000_000;
const columns = [
  ['company', 'Компания'],
  ['title', 'Должность'],
  ['stage', 'Этап'],
  ['location', 'Место и формат'],
  ['salary', 'Зарплата'],
  ['url', 'Ссылка'],
  ['description', 'Описание'],
  ['skills', 'Навыки'],
  ['notes', 'Заметки'],
  ['interviewDate', 'Дата собеседования'],
  ['nextActionDate', 'Дата следующего действия'],
  ['nextAction', 'Следующее действие'],
] as const;
const dangerous = (value: string) => /^[\s]*[=+\-@]|^[\t\r\n']/.test(value);
const encode = (value: string) =>
  '"' + (dangerous(value) ? "'" + value : value).replace(/"/g, '""') + '"';
const decode = (value: string) =>
  value.startsWith("'") && dangerous(value.slice(1)) ? value.slice(1) : value;
export function exportCSV(jobs: JobInput[]): string {
  return (
    '\uFEFF' +
    [
      columns.map(([, title]) => encode(title)).join(';'),
      ...jobs.map((job) =>
        columns
          .map(([key]) =>
            encode(
              key === 'skills'
                ? JSON.stringify(job.skills)
                : key === 'stage'
                  ? labels[job.stage]
                  : job[key],
            ),
          )
          .join(';'),
      ),
    ].join('\r\n')
  );
}
export function duplicateKey(job: JobInput): string {
  if (job.url) {
    try {
      const url = new URL(job.url);
      if (url.hostname === 'hh.ru' || url.hostname.endsWith('.hh.ru')) {
        const id = /^\/vacancy\/(\d+)\/?$/.exec(url.pathname)?.[1];
        if (id) return 'hh:' + id;
      }
      url.hash = '';
      // Snapshot keys: deleting from the live iterator skips adjacent parameters.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const key of [...url.searchParams.keys()])
        if (key.startsWith('utm_')) url.searchParams.delete(key);
      return 'url:' + url.toString();
    } catch {
      /* validated separately */
    }
  }
  return (
    'title:' +
    JSON.stringify([
      job.company.trim().toLowerCase(),
      job.title.trim().toLowerCase(),
    ])
  );
}
// RFC-style quoted cells, escaped quotes and multiline values. Only comma/semicolon dialects.
function rows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  if (text.includes('\0')) throw Error('CSV содержит недопустимые символы.');
  const first = text.split(/\r?\n/, 1)[0];
  const separator = first.includes(';') ? ';' : ',';
  const result: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(value);
    value = '';
    closed = false;
  };
  const end = () => {
    cell();
    if (row.some((v) => v.trim())) result.push(row);
    row = [];
    if (result.length > CSV_LIMIT + 1)
      throw Error(`За один раз можно импортировать до ${CSV_LIMIT} вакансий.`);
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
      continue;
    }
    if (c === separator) {
      cell();
      if (row.length > columns.length)
        throw Error('Слишком много столбцов в CSV.');
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      end();
      continue;
    }
    if (closed) throw Error('Лишний символ после закрывающей кавычки в CSV.');
    if (c === '"') {
      if (value) throw Error('Некорректные кавычки в CSV.');
      quoted = true;
    } else value += c;
  }
  if (quoted) throw Error('В CSV не закрыты кавычки.');
  if (value || row.length || closed) end();
  return result;
}
export type CSVRow = { row: number; job?: JobInput; error?: string };
export function parseCSV(text: string): CSVRow[] {
  if (new TextEncoder().encode(text).length > CSV_BYTES)
    throw Error('Файл должен быть не больше 2 МБ.');
  const data = rows(text);
  if (data.length < 2)
    throw Error(
      'В файле нет вакансий. Скачайте шаблон и заполните хотя бы одну строку.',
    );
  const header = data.shift()!;
  const keys = header.map(
    (h) =>
      columns.find(([key, title]) =>
        [key.toLowerCase(), title.toLowerCase()].includes(
          h.trim().toLowerCase(),
        ),
      )?.[0],
  );
  if (keys.some((k) => !k) || new Set(keys).size !== keys.length)
    throw Error(
      'Неизвестные или повторяющиеся столбцы. Используйте заголовки из шаблона.',
    );
  if (!keys.includes('company') || !keys.includes('title'))
    throw Error('Нужны столбцы «Компания» и «Должность».');
  return data.map((values, index) => {
    try {
      if (values.length !== keys.length)
        throw Error('Количество ячеек не совпадает с заголовком.');
      const raw: Record<string, unknown> = { ...blank, skills: [] };
      values.forEach((v, i) => {
        raw[keys[i]!] = decode(v);
      });
      const stage = String(raw.stage).trim();
      raw.stage =
        stages.find(
          (s) => s === stage || labels[s].toLowerCase() === stage.toLowerCase(),
        ) ?? (stage ? stage : 'saved');
      if (typeof raw.skills === 'string') {
        const skills = raw.skills.trim();
        raw.skills = skills.startsWith('[')
          ? JSON.parse(skills)
          : skills
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean);
      }
      return { row: index + 2, job: validateJob(raw) };
    } catch (e) {
      return {
        row: index + 2,
        error: e instanceof Error ? e.message : 'Проверьте строку.',
      };
    }
  });
}
export function previewCSV(text: string, existing: JobInput[]) {
  const seen = new Set(existing.map(duplicateKey));
  return parseCSV(text).map((row) => {
    const key = row.job ? duplicateKey(row.job) : '';
    const duplicate = !!row.job && seen.has(key);
    if (row.job) seen.add(key);
    return { ...row, duplicate };
  });
}
