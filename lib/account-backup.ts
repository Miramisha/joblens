import { validateJob, stages, type Job } from './jobs.ts';
export const BACKUP_LIMIT = 5_000_000;
function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !Number.isFinite(Date.parse(value))
  )
    throw Error('Некорректная дата в копии.');
  return value;
}
export function parseBackup(value: unknown, email: string) {
  const data = value as Record<string, unknown> | null;
  if (!data || data.format !== 'joblens-account-export' || data.version !== 1)
    throw Error('Нужна копия JobLens версии 1.');
  const profile = data.profile as Record<string, unknown> | null;
  if (
    !profile ||
    typeof profile.email !== 'string' ||
    profile.email.toLowerCase() !== email.toLowerCase()
  )
    throw Error('Копия принадлежит другой почте.');
  if (
    typeof profile.displayName !== 'string' ||
    !profile.displayName.trim() ||
    profile.displayName.length > 80 ||
    typeof profile.skills !== 'string' ||
    profile.skills.length > 1800
  )
    throw Error('Некорректный профиль.');
  if (!Array.isArray(data.jobs) || data.jobs.length > 100)
    throw Error('Можно восстановить до 100 вакансий за один раз.');
  const ids = new Set<string>();
  const jobs = data.jobs.map((raw): Job => {
    const job = raw as Job;
    const input = validateJob(raw);
    if (
      typeof job.id !== 'string' ||
      !job.id ||
      job.id.length > 150 ||
      ids.has(job.id)
    )
      throw Error('Некорректные или повторяющиеся идентификаторы вакансий.');
    ids.add(job.id);
    if (!Array.isArray(job.history) || job.history.length > 1000)
      throw Error('Некорректная история вакансии.');
    const history = job.history.map((h) => {
      if (
        !h ||
        !stages.includes(h.stage) ||
        typeof h.action !== 'string' ||
        h.action.length > 1000
      )
        throw Error('Некорректное событие истории.');
      return { at: date(h.at), stage: h.stage, action: h.action };
    });
    return {
      ...input,
      id: job.id,
      revision: 1,
      createdAt: date(job.createdAt),
      updatedAt: date(job.updatedAt),
      history,
    };
  });
  return {
    profile: {
      displayName: profile.displayName.trim(),
      skills: profile.skills,
    },
    jobs,
  };
}
