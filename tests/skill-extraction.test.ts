import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSkills, mergeSkills } from '../lib/skill-extraction.ts';
const names = (text: string) => extractSkills(text).map((s) => s.name);
void test('extracts aliases and repeated technologies only once', () => {
  assert.deepEqual(names('Нужны React.js, TS, JS, React и Postgres.'), [
    'React',
    'TypeScript',
    'JavaScript',
    'PostgreSQL',
  ]);
});
void test('respects word boundaries and longest mentions', () => {
  assert.deepEqual(
    names('JavaScript React Native, React Testing Library, GitHub Actions.'),
    ['JavaScript', 'React Native', 'Testing Library', 'GitHub Actions'],
  );
  assert.deepEqual(
    names('reaction, PostgreSQL, GitHub, Django, go to office'),
    ['PostgreSQL', 'Django'],
  );
});
void test('handles Unicode text, punctuation, languages and source offsets', () => {
  const text = 'Ищем React-разработчика: C++, C#, .NET; Go / golang. 🚀 Python';
  assert.deepEqual(names(text), ['React', 'C++', 'C#', '.NET', 'Go', 'Python']);
  for (const item of extractSkills(text))
    assert.equal(text.slice(item.start, item.end), item.matchedText);
});
void test('reports mentions even when optional or negated, leaving interpretation to the user', () => {
  assert.deepEqual(names('Docker не требуется. Kubernetes будет плюсом.'), [
    'Docker',
    'Kubernetes',
  ]);
});
void test('handles empty text and enforces length boundary', () => {
  assert.deepEqual(extractSkills(''), []);
  assert.deepEqual(names('x'.repeat(20000)), []);
  assert.throws(() => extractSkills('x'.repeat(20001)));
});
void test('merge preserves manual skills and avoids alias duplicates', () => {
  assert.deepEqual(
    mergeSkills(['JS', 'Коммуникация'], ['JavaScript', 'TypeScript']),
    ['JS', 'Коммуникация', 'TypeScript'],
  );
  assert.throws(() =>
    mergeSkills(
      Array.from({ length: 30 }, (_, i) => `Skill ${i}`),
      ['React'],
    ),
  );
});
