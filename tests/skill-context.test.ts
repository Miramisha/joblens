import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { analyzeSkillContext, predictContext } from '../lib/skill-context.ts';

void test('browser inference matches Python evaluation on all held-out samples', () => {
  const report = JSON.parse(
    readFileSync(
      new URL('../ml/artifacts/report.json', import.meta.url),
      'utf8',
    ),
  );
  for (const row of report.predictions) {
    const start = row.text.indexOf(row.skill);
    assert.equal(
      predictContext(row.text, start, start + row.skill.length),
      row.predicted,
      row.id,
    );
  }
});
void test('unclear, multiple, long and repeated contexts require review', () => {
  for (const text of [
    'React',
    'Нужны React и Docker.',
    'Нужен React. React не требуется.',
    'React ' + 'текст '.repeat(120),
  ]) {
    assert.equal(analyzeSkillContext(text, '')[0].label, 'review', text);
  }
});
void test('keeps technology dots, aliases, Unicode offsets and private skill comparison', () => {
  const text =
    '🚀 Знание Docker будет плюсом. Требуется опыт работы с Node.js.';
  const results = analyzeSkillContext(text, 'Docker, NodeJS');
  assert.equal(results.length, 2);
  assert.equal(
    results[0].label,
    predictContext('🚀 Знание Docker будет плюсом.', 10, 16),
  );
  assert.ok(results.every((r) => r.owned));
  assert.match(results[1].excerpts[0], /Node\.js/);
  assert.deepEqual(analyzeSkillContext('Без упоминаний технологий', ''), []);
  assert.throws(() => analyzeSkillContext('x'.repeat(20001), ''));
});

void test('large repeated fragments stay bounded and produce one review result', () => {
  const start = performance.now();
  const result = analyzeSkillContext('React '.repeat(3333), 'React');
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'review');
  assert.equal(result[0].excerpts.length, 1);
  // Broad guard against the old quadratic full-fragment tokenization (~1s locally).
  assert.ok(performance.now() - start < 1000);
});
