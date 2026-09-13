'use client';
// oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The horizontal chart needs focus for native keyboard scrolling.
import { useEffect, useRef, useState } from 'react';
import type { Job } from '@/lib/jobs';
import { jobInsights, type Period } from '@/lib/job-insights';

const periods: { value: Period; label: string }[] = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
];
export function JobInsights({
  jobs,
  onEdit,
}: {
  jobs: Job[];
  onEdit: (job: Job) => void;
}) {
  const [period, setPeriod] = useState<Period>('30');
  const chartRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) chart.scrollLeft = chart.scrollWidth;
  }, [jobs, period]);
  const data = jobInsights(jobs, period);
  const max = Math.max(1, ...data.timeline.map((d) => d.count));
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(
      'ru',
      data.monthly
        ? { month: 'short', year: 'numeric' }
        : { day: 'numeric', month: 'short' },
    ).format(new Date(`${date}${data.monthly ? '-01' : ''}T12:00:00`));
  return (
    <section className="insights" aria-label="Аналитика откликов">
      <div className="insights-heading">
        <div>
          <h2>Как идёт поиск</h2>
          <p>Отклики за выбранный период и их результат на сегодня.</p>
        </div>
        <fieldset className="period-picker" aria-label="Период аналитики">
          {periods.map((p) => (
            <button
              key={p.value}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </fieldset>
      </div>
      <article className="analytics-card">
        <h2>Воронка откликов</h2>
        <div className="funnel-metrics">
          <div>
            <span>Отклики</span>
            <strong>{data.applied}</strong>
            <small>Первый отклик по каждой вакансии</small>
          </div>
          <div>
            <span>Собеседования</span>
            <strong>{data.interviews}</strong>
            <small>
              {data.interviewRate === null
                ? 'Нет откликов для расчёта'
                : `${data.interviewRate}% от откликов`}
            </small>
          </div>
          <div>
            <span>Офферы</span>
            <strong>{data.offers}</strong>
            <small>
              {data.offerRate === null
                ? 'Нет собеседований для расчёта'
                : `${data.offerRate}% от собеседований`}
            </small>
          </div>
        </div>
        <p className="insights-method">
          Каждая вакансия учитывается один раз, по первой записи об отклике.
          Прямой переход в собеседование, оффер или отказ предполагает отклик в
          день этого перехода; оффер предполагает пройденное интервью.
          Импортированные карточки учитываются с даты добавления в JobLens.
        </p>
      </article>
      <article className="analytics-card">
        <h2>Динамика откликов</h2>
        <p>
          {data.monthly
            ? 'По месяцам: история длиннее 90 дней.'
            : 'По дням, включая дни без откликов.'}{' '}
          Повторные переходы и правки заметок не увеличивают счётчик.
        </p>
        {data.applied ? (
          <>
            <section
              ref={chartRef}
              className="activity-scroll"
              tabIndex={0}
              aria-label="График откликов, прокручивается по горизонтали"
            >
              <div className="activity-chart">
                {data.timeline.map((point) => (
                  <div
                    className="activity-column"
                    key={point.date}
                    title={`${formatDate(point.date)}: ${point.count}`}
                  >
                    <span className="activity-count">{point.count}</span>
                    <div className="activity-track">
                      <div
                        style={{ height: `${(point.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="activity-date">
                      {formatDate(point.date)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <details className="activity-table">
              <summary>Посмотреть данные таблицей</summary>
              <div>
                <table>
                  <caption>Количество первых откликов</caption>
                  <thead>
                    <tr>
                      <th scope="col">{data.monthly ? 'Месяц' : 'Дата'}</th>
                      <th scope="col">Отклики</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeline.map((point) => (
                      <tr key={point.date}>
                        <th scope="row">{formatDate(point.date)}</th>
                        <td>{point.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="empty-copy">
            За этот период откликов нет. Выбери другой период или отправь первый
            отклик и обнови этап вакансии.
          </p>
        )}
      </article>
      <article className="analytics-card upcoming stale-jobs">
        <h2>Без движения · {data.stale.length}</h2>
        <p>
          Все активные отклики и собеседования без смены этапа 7 дней и дольше,
          независимо от выбранного периода. Это повод проверить статус, а не
          признак отказа.
        </p>
        {data.stale.length ? (
          <div className="action-list">
            {data.stale.map(({ job, days }) => (
              <button key={job.id} onClick={() => onEdit(job)}>
                <span className="action-description">
                  <strong>{job.company}</strong>
                  <small>{job.title}</small>
                </span>
                <span className="action-date">Без движения: {days} дн.</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            Нет активных вакансий без движения дольше недели.
          </p>
        )}
      </article>
    </section>
  );
}
