'use client';
import { useId, useState } from 'react';
import { ScanText, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  extractSkills,
  mergeSkills,
  skillKey,
  type SkillMention,
} from '@/lib/skill-extraction';

export function SkillSuggestions({
  description,
  skills,
  onApply,
  source = 'vacancy',
}: {
  source?: 'vacancy' | 'resume';
  description: string;
  skills: string;
  onApply: (skills: string) => void;
}) {
  const isResume = source === 'resume';
  const title = isResume ? 'Навыки из резюме' : 'Навыки из описания';
  const groupId = useId();
  const [analysis, setAnalysis] = useState<{
    text: string;
    mentions: SkillMention[];
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const existing = skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingKeys = new Set(existing.map(skillKey));
  const suggestions =
    analysis?.mentions.filter((s) => !existingKeys.has(skillKey(s.name))) ?? [];
  const chosen = suggestions.filter((s) => selected.includes(s.name));
  const stale = analysis !== null && analysis.text !== description;
  function analyze() {
    setError('');
    setMessage('');
    try {
      setAnalysis({ text: description, mentions: extractSkills(description) });
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось найти навыки.');
    }
  }
  function apply() {
    if (stale || !chosen.length) return;
    try {
      const merged = mergeSkills(
        existing,
        chosen.map((s) => s.name),
      );
      onApply(merged.join(', '));
      setSelected([]);
      setError('');
      setMessage(
        `Добавлено навыков: ${chosen.length}. Сохрани ${isResume ? 'профиль' : 'карточку'}, чтобы оставить изменения.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить навыки.');
    }
  }
  return (
    <section className="skill-suggestions" aria-label={title}>
      <div className="suggestions-heading">
        <div>
          <h3>{title}</h3>
          <p>Найди упоминания технологий и выбери подходящие.</p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={!description.trim()}
          onClick={analyze}
        >
          <ScanText size={16} />
          {analysis ? 'Найти заново' : 'Найти навыки'}
        </button>
      </div>
      {!description.trim() && (
        <p className="suggestions-help">
          {isResume
            ? 'Вставь текст резюме в поле выше.'
            : 'Сначала вставь текст в поле «Описание вакансии».'}
        </p>
      )}
      {stale ? (
        <output className="suggestions-help">
          Текст изменился. Нажми «Найти заново», чтобы обновить предложения.
        </output>
      ) : (
        analysis && (
          <>
            {suggestions.length ? (
              <>
                <p className="suggestions-help">
                  {isResume
                    ? 'Выбери технологии, которыми владеешь. Упоминание в резюме само по себе не подтверждает навык.'
                    : 'Это упоминания в тексте, а не оценка требований. Проверь контекст: технология может быть необязательной.'}
                </p>
                <div className="suggestion-list">
                  {suggestions.map((item) => (
                    <label
                      className="suggestion-item"
                      key={item.name}
                      htmlFor={`${groupId}-${encodeURIComponent(item.name)}`}
                    >
                      <Checkbox
                        id={`${groupId}-${encodeURIComponent(item.name)}`}
                        checked={selected.includes(item.name)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? [...prev, item.name]
                              : prev.filter((s) => s !== item.name),
                          )
                        }
                        aria-label={`Добавить навык ${item.name}`}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.excerpt}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="suggestions-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setSelected(
                        chosen.length === suggestions.length
                          ? []
                          : suggestions.map((s) => s.name),
                      )
                    }
                  >
                    {chosen.length === suggestions.length
                      ? 'Снять выбор'
                      : 'Выбрать все'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={apply}
                    disabled={!chosen.length}
                  >
                    <Plus size={15} />
                    Добавить выбранные
                    {chosen.length ? ` (${chosen.length})` : ''}
                  </button>
                </div>
              </>
            ) : (
              <output className="suggestions-help">
                {analysis.mentions.length
                  ? `Все найденные навыки уже есть ${isResume ? 'в профиле' : 'в карточке'}.`
                  : 'Знакомых технологий не найдено. Навыки можно указать вручную.'}
              </output>
            )}
          </>
        )
      )}
      {message && !stale && (
        <output className="suggestions-help">{message}</output>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
