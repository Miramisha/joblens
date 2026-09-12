import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank } from '../lib/jobs.ts';
import { exportCSV, parseCSV, previewCSV } from '../lib/job-csv.ts';
const job = {
  ...blank,
  company: 'Компания; "А"',
  title: 'Frontend',
  description: 'Строка 1\nСтрока 2',
  notes: '=HYPERLINK("https://example.com")',
  skills: ['React', 'A|B'],
};
void test('CSV roundtrip preserves multiline text, quotes, skills and formula-like literals', () => {
  const csv = exportCSV([job]);
  assert.match(csv, /'=HYPERLINK/);
  assert.deepEqual(parseCSV(csv)[0].job, job);
  for (const notes of [
    "'hello",
    '\t=SUM(1)',
    '+123',
    ' @cmd',
    '-100',
    'ordinary',
  ])
    assert.equal(
      parseCSV(exportCSV([{ ...job, notes }]))[0].job?.notes,
      notes.trim(),
    );
});
void test('supports comma headers, optional fields and readable stages', () => {
  const row = parseCSV('company,title,stage\r\nCompany,Go,Собеседование')[0];
  assert.equal(row.job?.stage, 'interview');
  assert.equal(row.job?.notes, '');
  assert.equal(parseCSV('Компания;Должность\nA;B')[0].job?.stage, 'saved');
});
void test('rejects malformed rows, dangerous URLs, unknown headers and oversized imports', () => {
  assert.throws(() => parseCSV('company,title\n"unclosed,B'));
  assert.throws(() => parseCSV('company,title,title\nA,B,C'));
  assert.throws(() =>
    parseCSV(
      'company,title\n' + Array.from({ length: 101 }, () => 'A,B').join('\n'),
    ),
  );
  assert.ok(parseCSV('company,title,url\nA,B,javascript:alert(1)')[0].error);
  assert.ok(parseCSV('company,title,interviewDate\nA,B,2026-02-30')[0].error);
  assert.ok(parseCSV('company,title\nA,B,C')[0].error);
});
void test('preview marks existing and intra-file duplicates without changing data', () => {
  const existing = { ...job, url: 'https://hh.ru/vacancy/123?from=search' };
  const csv = exportCSV([
    { ...job, url: 'https://spb.hh.ru/vacancy/123' },
    job,
    job,
  ]);
  const rows = previewCSV(csv, [existing]);
  assert.deepEqual(
    rows.map((r) => r.duplicate),
    [true, false, true],
  );
});
