import { skillKey } from './skill-extraction.ts';

/** Compares explicit skill lists; does not predict hiring outcomes. */
export function compareSkills(required: string[], personal: string[]) {
  const unique = new Map<string, string>();
  for (const value of required) {
    const name = value.trim();
    if (name && !unique.has(skillKey(name))) unique.set(skillKey(name), name);
  }
  const owned = new Set(personal.map(skillKey).filter(Boolean));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const [key, name] of unique) {
    (owned.has(key) ? matched : missing).push(name);
  }
  return {
    matched,
    missing,
    total: unique.size,
    percent: unique.size
      ? Math.round((matched.length / unique.size) * 100)
      : null,
  };
}

/** Unscored vacancies follow scored ones; equal coverage keeps original order. */
export function compareCoverage(
  a: ReturnType<typeof compareSkills>,
  b: ReturnType<typeof compareSkills>,
) {
  if (!a.total) return b.total ? 1 : 0;
  if (!b.total) return -1;
  return b.matched.length / b.total - a.matched.length / a.total;
}
