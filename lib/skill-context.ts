import model from '../ml/artifacts/model.json' with { type: 'json' };
import { extractSkills, skillKey } from './skill-extraction.ts';

export type ContextLabel = 'required' | 'optional' | 'not_required';
export const CONTEXT_MODEL_VERSION = model.version;
const labels: ContextLabel[] = ['required', 'optional', 'not_required'];
const weights = model.log_likelihood as Record<
  ContextLabel,
  Record<string, number>
>;
export function contextFeatures(text: string, start: number, end: number) {
  if (!(start >= 0 && start < end && end <= text.length))
    throw new Error('Invalid mention offsets');
  const masked = `${text.slice(0, start)} targetskill ${text.slice(end)}`;
  const words = masked.toLowerCase().match(/[a-zа-яё0-9]+/g) ?? [];
  return [...words, ...words.slice(1).map((word, i) => `${words[i]}|${word}`)];
}
/** Exact inference for the versioned Python-trained model; scores are not confidence. */
export function predictContext(
  text: string,
  start: number,
  end: number,
): ContextLabel {
  const features = contextFeatures(text, start, end);
  const score = (label: ContextLabel) =>
    features.reduce(
      (sum, feature) =>
        sum +
        (Object.hasOwn(weights[label], feature) ? weights[label][feature] : 0),
      model.log_prior[label],
    );
  return labels.reduce((best, label) =>
    score(label) > score(best) ? label : best,
  );
}
export type ContextResult = {
  name: string;
  label: ContextLabel | 'review';
  excerpts: string[];
  reason?: string;
  owned: boolean;
};

export function analyzeSkillContext(
  text: string,
  personal: string,
): ContextResult[] {
  const mentions = extractSkills(text, false);
  const owned = new Set(personal.split(',').map(skillKey));
  // Sentence/newline boundaries preserve dots inside names such as Node.js.
  const boundaries = [0];
  for (const match of text.matchAll(/[!?;\n]|\.(?=\s|$)/g))
    boundaries.push(match.index + match[0].length);
  boundaries.push(text.length);
  const results = new Map<string, ContextResult>();
  for (const mention of mentions) {
    const end =
      boundaries.find((boundary) => boundary >= mention.end) ?? text.length;
    const start =
      boundaries.filter((boundary) => boundary <= mention.start).at(-1) ?? 0;
    const excerpt = text.slice(start, end);
    const nearby = mentions.filter(
      (other) => other.start >= start && other.end <= end,
    );
    const fs = contextFeatures(
      excerpt,
      mention.start - start,
      mention.end - start,
    );
    const informative = fs.filter(
      (f) => !f.includes('targetskill') && Object.hasOwn(weights.required, f),
    );
    const reason =
      excerpt.length > 500
        ? 'Слишком длинный фрагмент.'
        : nearby.length > 1
          ? 'Несколько упоминаний в одном фрагменте: проверь требования вручную.'
          : new Set(informative).size < 2
            ? 'Недостаточно знакомого модели контекста.'
            : undefined;
    const label = reason
      ? 'review'
      : predictContext(excerpt, mention.start - start, mention.end - start);
    const previous = results.get(mention.name);
    if (previous) {
      if (!previous.excerpts.includes(excerpt.trim()))
        previous.excerpts.push(excerpt.trim());
      if (previous.label !== label) {
        previous.label = 'review';
        previous.reason =
          'Повторные упоминания дают разные результаты. Проверь весь контекст.';
      }
    } else
      results.set(mention.name, {
        name: mention.name,
        label,
        reason,
        excerpts: [excerpt.trim()],
        owned: owned.has(skillKey(mention.name)),
      });
  }
  return [...results.values()];
}
