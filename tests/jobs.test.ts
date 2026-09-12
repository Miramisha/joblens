import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analytics, blank, validateJob, demoJobs } from '../lib/jobs.ts';
void test('validation normalizes and deduplicates skills case-insensitively', () => {
  const result = validateJob({
    ...blank,
    company: ' Test ',
    title: 'Frontend',
    skills: ['React', 'react', ' TypeScript ', ''],
  });
  assert.equal(result.company, 'Test');
  assert.deepEqual(result.skills, ['react', 'TypeScript']);
});
void test('validation rejects dangerous links, invalid dates and malformed data', () => {
  const input = { ...blank, company: 'Test', title: 'Frontend' };
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'not a url'])
    assert.throws(() => validateJob({ ...input, url }));
  for (const interviewDate of ['2026-02-30', '2026-13-01', 'invalid'])
    assert.throws(() => validateJob({ ...input, interviewDate }));
  for (const nextActionDate of ['2026-02-30', '2026-13-01', 'invalid'])
    assert.throws(() => validateJob({ ...input, nextActionDate }));
  assert.throws(() => validateJob({ ...input, nextAction: 'x'.repeat(501) }));
  assert.throws(() => validateJob({ ...input, nextActionDate: null }));
  assert.throws(() => validateJob({ ...input, company: '' }));
  assert.throws(() => validateJob({ ...input, stage: 'unknown' }));
  assert.throws(() => validateJob({ ...input, skills: [4] }));
  assert.equal(
    validateJob({ ...input, url: 'https://example.com/job' }).url,
    'https://example.com/job',
  );
  assert.deepEqual(
    validateJob({
      company: 'Test',
      title: 'Frontend',
      stage: 'saved',
      location: '',
      salary: '',
      url: '',
      description: '',
      skills: [],
      notes: '',
      interviewDate: '',
    }),
    {
      ...input,
      nextActionDate: '',
      nextAction: '',
    },
  );
});
void test('analytics keeps reached interviews after rejection and never double counts skills', () => {
  const job = demoJobs()[0];
  job.stage = 'rejected';
  job.skills = ['React', 'react'];
  job.history.push({
    stage: 'interview',
    at: job.createdAt,
    action: 'Этап изменён',
  });
  const result = analytics([job]);
  assert.equal(result.applied, 1);
  assert.equal(result.interviews, 1);
  assert.equal(result.conversion, 100);
  assert.equal(result.skills[0].count, 1);
  assert.equal(analytics([]).conversion, 0);
  assert.deepEqual(analytics([]).skills, []);
});
