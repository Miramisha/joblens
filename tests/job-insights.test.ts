import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, type Job, type Stage } from '../lib/jobs.ts';
import { jobInsights, dayKey } from '../lib/job-insights.ts';

// Local calendar dates keep the boundary assertions valid in any test timezone.
const at = (day: string, time = '12:00:00') =>
  new Date(`${day}T${time}`).toISOString();
const now = new Date('2026-09-12T15:00:00');
function job(id: string, events: [string, Stage][]): Job {
  return {
    ...blank,
    id,
    company: id,
    title: 'Frontend',
    revision: events.length,
    stage: events.at(-1)![1],
    createdAt: at(events[0][0]),
    updatedAt: at(events.at(-1)![0]),
    history: events.map(([day, stage]) => ({
      at: at(day),
      stage,
      action: 'Карточка обновлена',
    })),
  };
}
void test('cohort uses first application date, retains later results and ignores repeat applications', () => {
  const jobs = [
    job('old', [
      ['2026-08-01', 'applied'],
      ['2026-09-10', 'interview'],
    ]),
    job('repeat', [
      ['2026-09-06', 'applied'],
      ['2026-09-07', 'saved'],
      ['2026-09-08', 'applied'],
      ['2026-09-09', 'offer'],
      ['2026-09-10', 'rejected'],
    ]),
    job('note', [
      ['2026-09-08', 'applied'],
      ['2026-09-12', 'applied'],
    ]),
  ];
  const data = jobInsights(jobs, '7', now);
  assert.deepEqual(
    [
      data.applied,
      data.interviews,
      data.offers,
      data.interviewRate,
      data.offerRate,
    ],
    [2, 1, 1, 50, 100],
  );
  assert.equal(
    data.timeline.reduce((sum, d) => sum + d.count, 0),
    2,
  );
  assert.equal(jobInsights(jobs, 'all', now).applied, 3);
});
void test('rolling calendar range includes the first midnight, excludes future events and fills zero days', () => {
  const boundary = job('boundary', [['2026-09-06', 'applied']]);
  boundary.history[0].at = at('2026-09-06', '00:00:00');
  const data = jobInsights(
    [
      boundary,
      job('before', [['2026-09-05', 'applied']]),
      job('future', [['2026-09-13', 'applied']]),
    ],
    '7',
    now,
  );
  assert.equal(data.applied, 1);
  assert.equal(data.timeline.length, 7);
  assert.deepEqual(data.timeline[0], { date: '2026-09-06', count: 1 });
  assert.deepEqual(data.timeline.at(-1), { date: dayKey(now), count: 0 });
  assert.equal(jobInsights([], '30', now).timeline[0].date, '2026-08-14');
});
void test('direct advanced stages infer reached stages and empty rates have no denominator', () => {
  const data = jobInsights(
    [
      job('offer', [['2026-09-10', 'offer']]),
      job('rejected', [['2026-09-11', 'rejected']]),
    ],
    '30',
    now,
  );
  assert.deepEqual([data.applied, data.interviews, data.offers], [2, 1, 1]);
  const empty = jobInsights([], 'all', now);
  assert.equal(empty.interviewRate, null);
  assert.equal(empty.offerRate, null);
  assert.deepEqual(empty.stale, []);
});
void test('stale applications ignore note edits, reset on stage changes, and exclude terminal stages', () => {
  const data = jobInsights(
    [
      job('notes', [
        ['2026-09-01', 'applied'],
        ['2026-09-12', 'applied'],
      ]),
      job('boundary', [['2026-09-05', 'interview']]),
      job('moved', [
        ['2026-09-01', 'applied'],
        ['2026-09-10', 'interview'],
      ]),
      job('rejected', [['2026-08-01', 'rejected']]),
      job('offer', [['2026-08-01', 'offer']]),
      job('saved', [['2026-08-01', 'saved']]),
    ],
    '7',
    now,
  );
  assert.deepEqual(
    data.stale.map((r) => [r.job.id, r.days]),
    [
      ['notes', 11],
      ['boundary', 7],
    ],
  );
});
void test('long history groups months with zero gaps without losing counts', () => {
  const data = jobInsights(
    [
      job('first', [['2026-01-31', 'applied']]),
      job('last', [['2026-09-12', 'applied']]),
    ],
    'all',
    now,
  );
  assert.equal(data.monthly, true);
  assert.equal(data.timeline.length, 9);
  assert.deepEqual(data.timeline[0], { date: '2026-01', count: 1 });
  assert.deepEqual(data.timeline[1], { date: '2026-02', count: 0 });
  assert.equal(
    data.timeline.reduce((sum, d) => sum + d.count, 0),
    2,
  );
});
