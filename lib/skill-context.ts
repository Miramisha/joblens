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
  // Mentions are sorted by the extractor. Walk each segment and mention once.
  let segment = 0;
  let index = 0;
  while (index < mentions.length) {
    const first = mentions[index];
    while (
      segment + 1 < boundaries.length &&
      boundaries[segment + 1] <= first.start
    )
      segment++;
    const start = boundaries[segment];
    const end = boundaries[segment + 1] ?? text.length;
    let next = index + 1;
    while (next < mentions.length && mentions[next].end <= end) next++;
    const excerpt = text.slice(start, end).trim();
    let reason: string | undefined =
      end - start > 500
        ? 'Слишком длинный фрагмент.'
        : next - index > 1
          ? 'Несколько упоминаний в одном фрагменте: проверь требования вручную.'
          : undefined;
    if (!reason) {
      const fs = contextFeatures(
        text.slice(start, end),
        first.start - start,
        first.end - start,
      );
      const informative = new Set(
        fs.filter(
          (f) =>
            !f.includes('targetskill') && Object.hasOwn(weights.required, f),
        ),
      );
      if (informative.size < 2)
        reason = 'Недостаточно знакомого модели контекста.';
    }
    const label = reason
      ? 'review'
      : predictContext(
          text.slice(start, end),
          first.start - start,
          first.end - start,
        );
    const names = new Set<string>();
    for (const mention of mentions.slice(index, next)) {
      if (names.has(mention.name)) continue;
      names.add(mention.name);
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
    index = next;
  }
  return [...results.values()];
}
