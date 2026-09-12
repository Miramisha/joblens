export const stages = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
] as const;
export type Stage = (typeof stages)[number];
export const labels: Record<Stage, string> = {
  saved: 'Сохранено',
  applied: 'Отклик отправлен',
  interview: 'Собеседование',
  offer: 'Оффер',
  rejected: 'Отказ',
};
export type JobInput = {
  company: string;
  title: string;
  location: string;
  salary: string;
  url: string;
  description: string;
  skills: string[];
  notes: string;
  interviewDate: string;
  nextActionDate: string;
  nextAction: string;
  stage: Stage;
};
export type Job = JobInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  history: { at: string; stage: Stage; action: string }[];
};
export const blank: JobInput = {
  company: '',
  title: '',
  location: '',
  salary: '',
  url: '',
  description: '',
  skills: [],
  notes: '',
  interviewDate: '',
  nextActionDate: '',
  nextAction: '',
  stage: 'saved',
};
export function validateJob(value: unknown): JobInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Некорректная вакансия.');
  const v: Record<string, unknown> = {
    nextActionDate: '',
    nextAction: '',
    ...(value as Record<string, unknown>),
  };
  const limits: Record<string, number> = {
    company: 120,
    title: 180,
    location: 160,
    salary: 120,
    url: 2048,
    description: 20000,
    notes: 10000,
    interviewDate: 10,
    nextActionDate: 10,
    nextAction: 500,
  };
  const out: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(limits)) {
    if (typeof v[key] !== 'string' || v[key].length > max)
      throw Error(
        `Проверьте поле «${key}»: превышен размер или неверный формат.`,
      );
    out[key] = v[key].trim();
  }
  if (!out.company || !out.title) throw Error('Укажите компанию и должность.');
  if (!stages.includes(v.stage as Stage))
    throw Error('Неизвестный этап отклика.');
  if (out.url) {
    let u: URL;
    try {
      u = new URL(out.url as string);
    } catch {
      throw Error('Введите полную ссылку на вакансию.');
    }
    if (!['https:', 'http:'].includes(u.protocol))
      throw Error('Ссылка должна начинаться с https:// или http://.');
  }
  for (const [field, message] of [
    ['interviewDate', 'Укажите корректную дату собеседования.'],
    ['nextActionDate', 'Укажите корректную дату следующего действия.'],
  ] as const) {
    const date = out[field] as string;
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw Error(message);
  }
  if (
    !Array.isArray(v.skills) ||
    v.skills.length > 30 ||
    v.skills.some((s) => typeof s !== 'string' || s.length > 60)
  )
    throw Error('Укажите до 30 навыков, каждый не длиннее 60 символов.');
  const unique = new Map<string, string>();
  for (const s of v.skills as string[]) {
    if (s.trim()) unique.set(s.trim().toLowerCase(), s.trim());
  }
  return { ...out, skills: [...unique.values()], stage: v.stage } as JobInput;
}
export function analytics(jobs: Job[]) {
  const reached = (j: Job, s: Stage[]) =>
    s.includes(j.stage) || j.history.some((h) => s.includes(h.stage));
  const applied = jobs.filter((j) =>
    reached(j, ['applied', 'interview', 'offer', 'rejected']),
  ).length;
  const interviews = jobs.filter((j) =>
    reached(j, ['interview', 'offer']),
  ).length;
  const offers = jobs.filter((j) => reached(j, ['offer'])).length;
  const skills = new Map<string, { name: string; count: number }>();
  for (const j of jobs)
    for (const s of new Set(j.skills.map((s) => s.toLowerCase()))) {
      const entry = skills.get(s);
      skills.set(s, {
        name: entry?.name ?? j.skills.find((t) => t.toLowerCase() === s) ?? s,
        count: (entry?.count ?? 0) + 1,
      });
    }
  return {
    total: jobs.length,
    applied,
    interviews,
    offers,
    conversion: applied ? Math.round((interviews / applied) * 100) : 0,
    skills: [...skills.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    ),
  };
}
export function demoJobs(): Job[] {
  const data: [string, string, Stage, string, string[]][] = [
    [
      'Orbit Studio',
      'Frontend-разработчик',
      'saved',
      '120 000 – 160 000 ₽',
      ['React', 'TypeScript', 'CSS'],
    ],
    [
      'Forma',
      'JavaScript-разработчик',
      'saved',
      '100 000 – 140 000 ₽',
      ['JavaScript', 'Vue', 'Git'],
    ],
    [
      'Northbyte',
      'React-разработчик',
      'applied',
      '140 000 – 180 000 ₽',
      ['React', 'TypeScript', 'REST API'],
    ],
    [
      'Wave',
      'Fullstack-разработчик',
      'applied',
      '150 000 – 200 000 ₽',
      ['TypeScript', 'Node.js', 'PostgreSQL'],
    ],
    [
      'Signal',
      'Frontend Engineer',
      'interview',
      '160 000 – 210 000 ₽',
      ['React', 'TypeScript', 'Testing Library'],
    ],
    [
      'Pixel Works',
      'Web-разработчик',
      'interview',
      '130 000 – 170 000 ₽',
      ['JavaScript', 'React', 'CSS'],
    ],
    [
      'Layer',
      'JavaScript-разработчик',
      'offer',
      '180 000 ₽',
      ['TypeScript', 'React', 'Git'],
    ],
    [
      'Vector',
      'Frontend-разработчик',
      'rejected',
      'Не указана',
      ['React', 'JavaScript', 'Git'],
    ],
  ];
  return data.map(([company, title, stage, salary, skills], i) => {
    const d = new Date();
    d.setDate(d.getDate() - i - 1);
    const at = d.toISOString();
    return {
      ...blank,
      id: `demo-${i}`,
      company,
      title,
      stage,
      salary,
      skills,
      location: 'Удалённо',
      description: `Учебный пример вакансии: ${title} в ${company}. Разработка интерфейсов, взаимодействие с API и работа в команде.\n\nСтек: ${skills.join(', ')}.`,
      notes:
        i === 4
          ? 'Подготовить рассказ о своём проекте и повторить работу с состоянием React.'
          : '',
      revision: 1,
      createdAt: at,
      updatedAt: at,
      history: [
        { at, stage: 'saved', action: 'Вакансия добавлена' },
        ...(stage !== 'saved' ? [{ at, stage, action: 'Этап изменён' }] : []),
      ],
    };
  });
}
