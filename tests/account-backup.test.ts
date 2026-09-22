import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from '../lib/account-backup.ts';
import { blank } from '../lib/jobs.ts';
const email = 'owner@example.test';
const backup = () => ({
  format: 'joblens-account-export',
  version: 1,
  profile: { email, displayName: 'Owner', skills: 'Go' },
  jobs: [
    {
      ...blank,
      company: 'Test',
      title: 'Engineer',
      id: 'one',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      history: [
        { at: '2026-09-01T00:00:00.000Z', stage: 'saved', action: 'Added' },
      ],
      secret: 'excluded',
    },
  ],
});
void test('backup restores validated fields/history and excludes extra properties', () => {
  const result = parseBackup(backup(), email);
  assert.equal(result.jobs[0].history.length, 1);
  assert.equal('secret' in result.jobs[0], false);
  assert.equal(result.jobs[0].revision, 1);
});
void test('backup rejects another owner, future version, duplicate IDs and invalid history/URLs', () => {
  const wrong = backup();
  wrong.profile.email = 'other@example.test';
  assert.throws(() => parseBackup(wrong, email));
  const version = backup();
  version.version = 2;
  assert.throws(() => parseBackup(version, email));
  const dup = backup();
  dup.jobs.push(dup.jobs[0]);
  assert.throws(() => parseBackup(dup, email));
  const history = backup();
  history.jobs[0].history[0].at = 'invalid';
  assert.throws(() => parseBackup(history, email));
  const url = backup();
  url.jobs[0].url = 'javascript:alert(1)';
  assert.throws(() => parseBackup(url, email));
  assert.throws(() => parseBackup(null, email));
});
