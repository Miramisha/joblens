import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  vacancyId,
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
