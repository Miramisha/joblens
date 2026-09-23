import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBackupFile } from '../lib/backup-file-reader.ts';
const email = 'owner@example.test';
const contents = (name: string) =>
  JSON.stringify({
    format: 'joblens-account-export',
    version: 1,
    profile: { email, displayName: name, skills: '' },
    jobs: [],
  });
function pendingFile() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { file: { size: 100, text: () => promise }, resolve, reject };
}
void test('slow previous selection cannot replace the most recently selected backup', async () => {
  const seq = { current: 0 },
    first = pendingFile(),
    second = pendingFile();
  const a = readBackupFile(first.file, email, seq);
  const b = readBackupFile(second.file, email, seq);
  second.resolve(contents('B'));
  const selected = await b;
  assert.equal(selected.status, 'ready');
  if (selected.status === 'ready') assert.equal(selected.text, contents('B'));
  first.resolve(contents('A'));
  assert.equal((await a).status, 'stale');
});
void test('clearing selection invalidates pending errors and results', async () => {
  const seq = { current: 0 },
    first = pendingFile();
  const a = readBackupFile(first.file, email, seq);
  assert.equal((await readBackupFile(undefined, email, seq)).status, 'empty');
  first.reject(Error('old read failed'));
  assert.equal((await a).status, 'stale');
});
