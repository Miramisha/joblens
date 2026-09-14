import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  vacancyId,
  vacancySourceNotes,
  mapVacancy,
  plainDescription,
} from '../lib/hh/vacancies.ts';
void test('only accepts numeric IDs and HTTPS vacancy links on hh.ru', () => {
  assert.equal(vacancyId('https://spb.hh.ru/vacancy/123?from=search'), '123');
  for (const u of [
    'https://hh.ru.evil.test/vacancy/1',
    'http://127.0.0.1/vacancy/1',
    'https://evil@hh.ru/vacancy/1',
    'https://hh.ru:123/vacancy/1',
    'https://hh.ru/vacancy/../token',
    'https://hh.ru/vacancy/1/more',
    'javascript:alert(1)',
  ])
    assert.equal(vacancyId(u), null);
});
void test('converts vacancy to bounded editable fields without rendering provider HTML', () => {
  const v = mapVacancy({
    id: '123',
    name: 'Frontend',
    employer: { name: 'Company' },
    area: { name: 'Москва' },
    salary: { from: 100000, to: null, currency: 'RUR', gross: false },
    description:
      '<p>React &amp; TypeScript</p><script>bad()</script><li>CSS</li>',
    key_skills: [{ name: 'React' }, { name: 'React' }],
  });
  assert.equal(v.url, 'https://hh.ru/vacancy/123');
  assert.deepEqual(v.skills, ['React']);
  assert.equal(v.description, 'React & TypeScript\n\nCSS');
  assert.match(v.salary, /на руки/);
  assert.equal(plainDescription('&#x110000; &lt;img src=x&gt;'), '<img src=x>');
  assert.throws(() =>
    mapVacancy({ id: '1', name: 'X', employer: { name: 'Y' }, archived: true }),
  );
  assert.throws(() => mapVacancy({ id: 'bad' }));
});

void test('imports work formats and publication date without inventing missing metadata', () => {
  const base = { id: '123', name: 'Developer', employer: { name: 'Company' } };
  const v = mapVacancy({
    ...base,
    work_format: [{ name: 'Удалённо' }, { name: 'Удалённо' }, null],
    published_at: '2026-09-14T00:30:00+0300',
  });
  assert.equal(v.workFormat, 'Удалённо');
  assert.equal(v.publishedAt, '2026-09-13T21:30:00.000Z');
  assert.equal(
    vacancySourceNotes(v),
    'Формат работы: Удалённо\nОпубликовано на hh.ru: 14.09.2026',
  );
  const missing = mapVacancy({
    ...base,
    work_format: {},
    published_at: 'invalid',
  });
  assert.equal(vacancySourceNotes(missing), '');
});
