/** Deterministic mention extraction. This is a baseline, not a trained ML model. */
export const EXTRACTOR_VERSION = 'dictionary-v1';
const dictionary: {
  name: string;
  aliases: string[];
  caseSensitive?: boolean;
}[] = [
  { name: 'JavaScript', aliases: ['JavaScript', 'JS', 'ECMAScript'] },
  { name: 'TypeScript', aliases: ['TypeScript', 'TS'] },
  { name: 'React Native', aliases: ['React Native'] },
  { name: 'React', aliases: ['React.js', 'ReactJS', 'React'] },
  { name: 'Next.js', aliases: ['Next.js', 'NextJS'] },
  { name: 'Vue', aliases: ['Vue.js', 'VueJS', 'Vue'] },
  { name: 'Nuxt', aliases: ['Nuxt.js', 'NuxtJS', 'Nuxt'] },
  { name: 'Angular', aliases: ['Angular'] },
  { name: 'Svelte', aliases: ['Svelte'] },
  { name: 'HTML', aliases: ['HTML5', 'HTML'] },
  { name: 'CSS', aliases: ['CSS3', 'CSS'] },
  { name: 'Sass', aliases: ['Sass', 'SCSS'] },
  { name: 'Tailwind CSS', aliases: ['Tailwind CSS', 'Tailwind'] },
  { name: 'Redux', aliases: ['Redux Toolkit', 'Redux'] },
  { name: 'Zustand', aliases: ['Zustand'] },
  { name: 'Node.js', aliases: ['Node.js', 'NodeJS'] },
  { name: 'NestJS', aliases: ['Nest.js', 'NestJS'] },
  { name: 'Express', aliases: ['Express.js', 'ExpressJS', 'Express'] },
  { name: 'Go', aliases: ['Go'], caseSensitive: true },
  { name: 'Go', aliases: ['Golang'] },
  { name: 'Python', aliases: ['Python', 'Python3'] },
  { name: 'Django', aliases: ['Django'] },
  { name: 'FastAPI', aliases: ['FastAPI'] },
  { name: 'Flask', aliases: ['Flask'] },
  { name: 'Java', aliases: ['Java'] },
  { name: 'Kotlin', aliases: ['Kotlin'] },
  { name: 'C++', aliases: ['C++'] },
  { name: 'C#', aliases: ['C#'] },
  { name: '.NET', aliases: ['.NET'] },
  { name: 'SQL', aliases: ['SQL'] },
  { name: 'PostgreSQL', aliases: ['PostgreSQL', 'Postgres'] },
  { name: 'MySQL', aliases: ['MySQL'] },
  { name: 'SQLite', aliases: ['SQLite'] },
  { name: 'MongoDB', aliases: ['MongoDB'] },
  { name: 'Redis', aliases: ['Redis'] },
  { name: 'Docker', aliases: ['Docker'] },
  { name: 'Kubernetes', aliases: ['Kubernetes', 'K8s'] },
  { name: 'Git', aliases: ['Git'] },
  { name: 'GitHub Actions', aliases: ['GitHub Actions'] },
  { name: 'GitLab CI', aliases: ['GitLab CI', 'GitLab CI/CD'] },
  { name: 'CI/CD', aliases: ['CI/CD'] },
  { name: 'REST API', aliases: ['REST API', 'RESTful', 'REST'] },
  { name: 'GraphQL', aliases: ['GraphQL'] },
  { name: 'gRPC', aliases: ['gRPC'] },
  { name: 'Linux', aliases: ['Linux'] },
  { name: 'Jest', aliases: ['Jest'] },
  { name: 'Vitest', aliases: ['Vitest'] },
  { name: 'Playwright', aliases: ['Playwright'] },
  { name: 'Cypress', aliases: ['Cypress'] },
  {
    name: 'Testing Library',
    aliases: ['React Testing Library', 'Testing Library'],
  },
  { name: 'Webpack', aliases: ['Webpack'] },
  { name: 'Vite', aliases: ['Vite'] },
  { name: 'pandas', aliases: ['pandas'] },
  { name: 'NumPy', aliases: ['NumPy'] },
  { name: 'scikit-learn', aliases: ['scikit-learn', 'sklearn'] },
  { name: 'PyTorch', aliases: ['PyTorch'] },
  { name: 'TensorFlow', aliases: ['TensorFlow'] },
];
export type SkillMention = {
  name: string;
  matchedText: string;
  start: number;
  end: number;
  excerpt: string;
};
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function skillKey(skill: string): string {
  const key = skill.trim().toLowerCase();
  return (
    dictionary
      .find((entry) =>
        entry.aliases.some((alias) => alias.toLowerCase() === key),
      )
      ?.name.toLowerCase() ?? key
  );
}
export function mergeSkills(existing: string[], additions: string[]): string[] {
  const result: string[] = [],
    seen = new Set<string>();
  for (const value of [...existing, ...additions]) {
    const name = value.trim(),
      key = skillKey(name);
    if (name && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }
  if (result.length > 30)
    throw new Error(
      'В карточке можно указать до 30 навыков. Выбери меньше предложений.',
    );
  return result;
}
export function extractSkills(
  text: string,
  deduplicate = true,
): SkillMention[] {
  if (typeof text !== 'string' || text.length > 20000)
    throw new Error('Описание должно быть не длиннее 20 000 символов.');
  const candidates: Omit<SkillMention, 'excerpt'>[] = [];
  for (const entry of dictionary) {
    for (const alias of entry.aliases) {
      // Unicode boundaries avoid matching Java in JavaScript or Git in GitHub.
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(alias)}(?![\\p{L}\\p{N}_])`,
        entry.caseSensitive ? 'gu' : 'giu',
      );
      for (const match of text.matchAll(pattern))
        candidates.push({
          name: entry.name,
          matchedText: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
    }
  }
  // Longest mention wins at each position: React Native is not also React.
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: SkillMention[] = [],
    seen = new Set<string>();
  let occupiedUntil = -1;
  for (const candidate of candidates) {
    if (candidate.start < occupiedUntil) continue;
    occupiedUntil = candidate.end;
    if (deduplicate && seen.has(candidate.name)) continue;
    seen.add(candidate.name);
    result.push({
      ...candidate,
      excerpt: `${candidate.start > 45 ? '…' : ''}${text.slice(Math.max(0, candidate.start - 45), Math.min(text.length, candidate.end + 65)).replace(/\s+/g, ' ')}${candidate.end + 65 < text.length ? '…' : ''}`,
    });
  }
  return result;
}
