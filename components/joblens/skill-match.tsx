'use client';
import Link from 'next/link';
import { compareSkills } from '@/lib/skill-match';

export function SkillMatch({
  skills,
  personal,
  onChange,
  fromProfile = false,
}: {
  fromProfile?: boolean;
  skills: string;
  personal: string;
  onChange: (value: string) => void;
}) {
  const result = compareSkills(skills.split(','), personal.split(','));
  return (
    <section className="skill-suggestions" aria-label="Сравнение навыков">
      <h3>Мои навыки и вакансия</h3>
      <label>
        Мои навыки через запятую
        <input
          readOnly={fromProfile}
          value={personal}
          maxLength={1800}
          onChange={(event) => onChange(event.target.value)}
          placeholder="JavaScript, React, Git"
        />
      </label>
      <p className="suggestions-help">
        {fromProfile ? (
          <Link href="/account">Изменить сохранённые навыки в профиле</Link>
        ) : (
          'Список доступен во всех карточках до перезагрузки страницы.'
        )}
      </p>
      {!result.total ? (
        <p>Добавь навыки вакансии в поле выше, чтобы сравнить их со своими.</p>
      ) : !personal.trim() ? (
        <p>Укажи свои навыки для сравнения.</p>
      ) : (
        <div aria-live="polite">
          <p>
            <strong>
              Совпало {result.matched.length} из {result.total} ·{' '}
              {result.percent}%
            </strong>
          </p>
          <p>Совпадения: {result.matched.join(', ') || 'пока нет'}.</p>
          <p>
            Не указаны у тебя:{' '}
            {result.missing.join(', ') || 'все навыки указаны'}.
          </p>
          <p className="suggestions-help">
            Сравниваем только навыки из карточки, учитывая названия вроде JS и
            JavaScript. Это не оценка опыта и не вероятность трудоустройства.
          </p>
        </div>
      )}
    </section>
  );
}
