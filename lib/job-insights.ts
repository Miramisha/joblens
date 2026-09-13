import type { Job, Stage } from './jobs.ts';

export type Period = '7' | '30' | 'all';
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayNumber = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

export function jobInsights(jobs: Job[], period: Period, now = new Date()) {
  const today = dayKey(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period !== 'all') start.setDate(start.getDate() - Number(period) + 1);
  const from = period === 'all' ? null : dayKey(start);
  const records = jobs.map((job) => {
    // Ignore edits within the same stage, including changes to notes and plans.
    const events = [...job.history]
      .filter(
        (h) =>
          Number.isFinite(Date.parse(h.at)) &&
          Date.parse(h.at) <= now.getTime(),
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    let previous: Stage | undefined;
    let firstApplied: string | null = null;
    let lastTransition: string | null = null;
    let interview = false;
    let offer = false;
    for (const event of events) {
      if (event.stage === previous) continue;
      previous = event.stage;
      lastTransition = event.at;
      if (event.stage !== 'saved') firstApplied ??= event.at;
      if (event.stage === 'interview' || event.stage === 'offer')
        interview = true;
      if (event.stage === 'offer') offer = true;
    }
    return { job, firstApplied, lastTransition, interview, offer };
  });
  const cohort = records.filter(({ firstApplied }) => {
    if (!firstApplied) return false;
    const day = dayKey(new Date(firstApplied));
    return (!from || day >= from) && day <= today;
  });
  const applied = cohort.length;
  const interviews = cohort.filter((r) => r.interview).length;
  const offers = cohort.filter((r) => r.offer).length;
  const rate = (n: number, total: number) =>
    total ? Math.round((n / total) * 100) : null;
  const firstDay =
    from ??
    cohort.map((r) => dayKey(new Date(r.firstApplied!))).sort()[0] ??
    today;
  const cursor = new Date(`${firstDay}T12:00:00`);
  const monthly = period === 'all' && dayNumber(now) - dayNumber(cursor) >= 90;
  const counts = new Map<string, number>();
  for (const r of cohort) {
    const day = dayKey(new Date(r.firstApplied!));
    const key = monthly ? day.slice(0, 7) : day;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const timeline: { date: string; count: number }[] = [];
  if (monthly) cursor.setDate(1);
  while (dayKey(cursor) <= today) {
    const key = monthly ? dayKey(cursor).slice(0, 7) : dayKey(cursor);
    timeline.push({ date: key, count: counts.get(key) ?? 0 });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  const stale = records
    .flatMap(({ job, lastTransition }) => {
      if (!lastTransition || !['applied', 'interview'].includes(job.stage))
        return [];
      const days = dayNumber(now) - dayNumber(new Date(lastTransition));
      return days >= 7 ? [{ job, days }] : [];
    })
    .sort((a, b) => b.days - a.days || a.job.id.localeCompare(b.job.id));
  return {
    applied,
    interviews,
    offers,
    interviewRate: rate(interviews, applied),
    offerRate: rate(offers, interviews),
    timeline,
    monthly,
    stale,
  };
}
