import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareSkills, compareCoverage } from '../lib/skill-match.ts';

void test('matches aliases, ignores duplicate requirements and preserves unknown skills', () => {
  assert.deepEqual(
    compareSkills(
      ['JS', 'JavaScript', ' React ', 'Custom'],
      ['javascript', 'react'],
    ),
    {
      matched: ['JS', 'React'],
      missing: ['Custom'],
      total: 3,
      percent: 67,
    },
  );
});
void test('empty requirements have no score and similar names remain distinct', () => {
  assert.equal(compareSkills([' '], ['Go']).percent, null);
  assert.deepEqual(
    compareSkills(['React Native', 'Java'], ['React', 'JavaScript']).missing,
    ['React Native', 'Java'],
  );
  assert.equal(compareSkills(['Go'], []).percent, 0);
});

void test('coverage order uses ratios, leaves ties stable and puts unknown last', () => {
  const personal = ['React', 'Git'];
  const rows = [[], ['Python'], ['React', 'Git', 'SQL'], ['React']];
  const result = rows
    .map((r) => compareSkills(r, personal))
    .sort(compareCoverage);
  assert.deepEqual(
    result.map((r) => r.percent),
    [100, 67, 0, null],
  );
  assert.equal(
    compareCoverage(
      compareSkills(['React'], personal),
      compareSkills(['Git'], personal),
    ),
    0,
  );
});
