'use client';
import { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { analyzeSkillContext, type ContextResult } from '@/lib/skill-context';
const titles = {
  required: 'Вероятно обязательный',
  optional: 'Вероятно желательный',
  not_required: 'Вероятно не требуется',
  review: 'Нужна ручная проверка',
};
export function MlSkillContext({
  description,
  personal,
}: {
  description: string;
  personal: string;
}) {
  const [analysis, setAnalysis] = useState<{
    text: string;
    personal: string;
    results: ContextResult[];
  } | null>(null);
  const [error, setError] = useState('');
  const stale =
    analysis &&
    (analysis.text !== description || analysis.personal !== personal);
  function analyze() {
    try {
      setAnalysis({
        text: description,
        personal,
        results: analyzeSkillContext(description, personal),
      });
      setError('');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Не удалось выполнить анализ.',
      );
    }
  }
  return (
    <section
      className="skill-suggestions ml-context"
      aria-label="ML-анализ требований"
    >
      <div className="suggestions-heading">
        <div>
          <h3>
            ML-анализ требований <span className="ml-label">Эксперимент</span>
          </h3>
          <p>Определи роль навыков в описании и сравни их со своими.</p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={!description.trim()}
          onClick={analyze}
        >
          <BrainCircuit size={16} />
          {analysis ? 'Повторить ML-анализ' : 'Анализировать с ML'}
        </button>
      </div>
      <p className="suggestions-help">
        Учебная модель может ошибаться, особенно на отрицаниях. Проверь цитаты.
        Анализ работает на твоём устройстве и не меняет навыки в карточке.
      </p>
      {!description.trim() && (
        <p className="suggestions-help">Сначала добавь описание вакансии.</p>
      )}
      <div aria-live="polite">
        {stale ? (
          <p>Описание или твои навыки изменились. Повтори анализ.</p>
        ) : (
          analysis && (
            <>
              {!analysis.results.length ? (
                <p>Знакомых технологий не найдено. Укажи навыки вручную.</p>
              ) : (
                <>
                  {!personal.trim() && (
                    <p>Укажи свои навыки выше, чтобы увидеть совпадения.</p>
                  )}
                  <ul className="ml-results">
                    {analysis.results.map((result) => (
                      <li key={result.name}>
                        <div className="ml-result-heading">
                          <strong>{result.name}</strong>
                          <span>{titles[result.label]}</span>
                        </div>
                        {personal.trim() && (
                          <p className="ml-personal">
                            {result.owned
                              ? 'Есть в твоём списке навыков'
                              : 'Не указан в твоём списке навыков'}
                          </p>
                        )}
                        {result.reason && <p>{result.reason}</p>}
                        {result.excerpts.map((excerpt, index) => (
                          <blockquote key={index}>{excerpt}</blockquote>
                        ))}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <details className="ml-details">
        <summary>Как работает анализ</summary>
        <p>
          Названия технологий находит словарь. Обученная модель Naive Bayes
          оценивает слова вокруг каждого упоминания. Сложные фрагменты
          отправляются на ручную проверку.
        </p>
        <p>
          Версия context-nb-v1: 60 искусственных примеров для обучения, 24 для
          проверки; macro F1 — 0,584. Качество на реальных вакансиях ещё не
          измерено. Результат не оценивает твой опыт или шанс получить работу.
        </p>
      </details>
    </section>
  );
}
