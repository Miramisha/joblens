'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  ScanLine,
  BriefcaseBusiness,
  LayoutGrid,
  ChartNoAxesCombined,
  RotateCw,
  CalendarDays,
  X,
  Trash2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import {
  analytics,
  blank,
  demoJobs,
  labels,
  stages,
  validateJob,
  type Job,
  type JobInput,
  type Stage,
} from '@/lib/jobs';
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(
    new Date(date),
  );
function StageSelect({
  value,
  onChange,
  label = 'Этап',
  all = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  all?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v)}
      items={[
        ...(all ? [{ value: 'all', label: 'Все этапы' }] : []),
        ...stages.map((value) => ({ value, label: labels[value] })),
      ]}
    >
      <SelectTrigger aria-label={label} className="stage-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all && <SelectItem value="all">Все этапы</SelectItem>}
        {stages.map((s) => (
          <SelectItem value={s} key={s}>
            {labels[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Workspace({ signedIn }: { signedIn: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [demo, setDemo] = useState(!signedIn),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [view, setView] = useState('board'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Job | null>(null),
    [form, setForm] = useState<JobInput>({ ...blank }),
    [skillText, setSkillText] = useState(''),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  const requestSeq = useRef(0),
    busy = useRef(false);
  async function reload() {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/jobs');
      const data = (await res.json()) as {
        error?: string;
        jobs: Job[];
        job: Job;
      };
      if (!res.ok) throw Error(data.error);
      if (seq === requestSeq.current) setJobs(data.jobs);
    } catch (e) {
      if (seq === requestSeq.current)
        setError(
          e instanceof Error ? e.message : 'Не удалось загрузить вакансии.',
        );
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (signedIn) void reload();
      else {
        setJobs(demoJobs());
        setLoaded(true);
      }
    });
    return () => {
      active = false;
      // Request sequence, not a DOM ref: invalidate pending responses on unmount.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      requestSeq.current++;
    };
  }, [signedIn]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  function changeMode(next: boolean) {
    requestSeq.current++;
    setDemo(next);

    setQuery('');
    setFilter('all');
    setError('');
    setNotice('');
    if (next) {
      setJobs(demoJobs());
      setLoaded(true);
      setLoading(false);
    } else {
      setJobs([]);
      setLoaded(false);
      void reload();
    }
  }
  function create(stage: Stage = 'saved') {
    setEditing(null);
    setForm({ ...blank, stage });
    setSkillText('');
    setFormError('');
    setOpen(true);
  }
  function edit(job: Job) {
    setEditing(job);
    setForm({ ...job });
    setSkillText(job.skills.join(', '));
    setFormError('');
    setOpen(true);
  }
  async function persist(input: JobInput, old: Job | null): Promise<Job> {
    const valid = validateJob(input);
    if (demo) {
      const at = new Date().toISOString();
      return {
        ...valid,
        id: old?.id ?? crypto.randomUUID(),
        revision: (old?.revision ?? 0) + 1,
        createdAt: old?.createdAt ?? at,
        updatedAt: at,
        history: [
          ...(old?.history ?? []),
          {
            at,
            stage: valid.stage,
            action: !old
              ? 'Вакансия добавлена'
              : old.stage === valid.stage
                ? 'Карточка обновлена'
                : 'Этап изменён',
          },
        ],
      };
    }
    const res = await fetch('/api/jobs', {
      method: old ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...valid,
        ...(old ? { id: old.id, revision: old.revision } : {}),
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      jobs: Job[];
      job: Job;
    };
    if (!res.ok) throw Error(data.error || 'Не удалось сохранить вакансию.');
    return data.job;
  }
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setFormError('');
    try {
      const job = await persist(
        {
          ...form,
          skills: skillText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        editing,
      );
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      setOpen(false);
      setNotice(
        demo
          ? 'Изменено в деморежиме. После перезагрузки пример сбросится.'
          : 'Вакансия сохранена.',
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function move(id: string, stage: Stage) {
    if (busy.current) return;
    const old = jobs.find((j) => j.id === id);
    if (!old || old.stage === stage) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const job = await persist({ ...old, stage }, old);
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
      setNotice(`Этап изменён: ${labels[stage]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить этап.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function remove() {
    if (!editing || busy.current) return;
    busy.current = true;
    setSaving(true);
    setFormError('');
    try {
      if (!demo) {
        const res = await fetch('/api/jobs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, revision: editing.revision }),
        });
        const data = (await res.json()) as {
          error?: string;
          jobs: Job[];
          job: Job;
        };
        if (!res.ok) throw Error(data.error);
      }
      setJobs((prev) => prev.filter((j) => j.id !== editing.id));
      setOpen(false);
      setConfirmDelete(false);
      setNotice('Вакансия удалена.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось удалить.');
      setConfirmDelete(false);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const life = new AbortController();
    const tool = {
      name: 'start_job_creation',
      title: 'Открыть создание вакансии',
      description:
        'Открывает форму JobLens с заполненными компанией и должностью. Не сохраняет вакансию.',
      inputSchema: {
        type: 'object',
        properties: {
          company: { type: 'string', maxLength: 120 },
          title: { type: 'string', maxLength: 180 },
        },
        required: ['company', 'title'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== 'object')
          throw Error('Expected company and title');
        const v = input as Record<string, unknown>;
        if (
          Object.keys(v).some((k) => !['company', 'title'].includes(k)) ||
          typeof v.company !== 'string' ||
          typeof v.title !== 'string' ||
          !v.company.trim() ||
          !v.title.trim() ||
          v.company.length > 120 ||
          v.title.length > 180
        )
          throw Error('Invalid company or title');
        if (busy.current) throw Error('Saving in progress');
        setEditing(null);
        setForm({ ...blank, company: v.company, title: v.title });
        setSkillText('');
        setFormError('');
        setOpen(true);
        return { status: 'form_opened', saved: false };
      },
    };
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: life.signal }),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, []);
  const all = analytics(jobs);
  const matches = jobs.filter(
    (j) =>
      (filter === 'all' || j.stage === filter) &&
      [j.title, j.company, ...j.skills]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = jobs
    .filter((j) => j.stage === 'interview' && j.interviewDate >= localDate)
    .sort((a, b) => a.interviewDate.localeCompare(b.interviewDate));
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <ScanLine size={23} />
          </span>
          joblens<span className="brand-dot">.</span>
        </Link>
        <span className="top-label">ТВОЯ КАРЬЕРА. ТВОЙ ПЛАН.</span>
        <div className="account">
          {signedIn ? (
            <>
              <span className="private-label">Личное пространство</span>
              <span className="avatar">JL</span>
            </>
          ) : (
            // SIWC requires top-level navigation; framework links may prefetch.
            // oxlint-disable-next-line next/no-html-link-for-pages
            <a
              className="secondary"
              href="/signin-with-chatgpt?return_to=%2F"
              target="_top"
            >
              Войти и сохранять
            </a>
          )}
        </div>
      </header>
      <div className="content">
        <div className="heading">
          <div>
            <p className="eyebrow">
              {demo ? 'ДЕМОПРОСТРАНСТВО' : 'РАБОЧЕЕ ПРОСТРАНСТВО'}
            </p>
            <h1>
              Следующий шаг в карьере<span>.</span>
            </h1>
            <p className="subtitle">Все возможности — в одном месте.</p>
          </div>
          <button
            className="primary"
            onClick={() => create()}
            disabled={saving || loading || !!error}
          >
            <Plus size={18} />
            Добавить вакансию
          </button>
        </div>
        <section className="stats" aria-label="Статистика поиска">
          {[
            ['Сохранено вакансий', all.total, 'Все вакансии в пространстве'],
            ['Отклики отправлены', all.applied, 'Включая последующие этапы'],
            ['Собеседования', all.interviews, 'Дошли до интервью или оффера'],
            ['Получено офферов', all.offers, 'В том числе в истории'],
          ].map(([l, v, h]) => (
            <div className="stat" key={l}>
              <span>{l}</span>
              <strong>{!loaded || loading ? '—' : v}</strong>
              <small>{h}</small>
            </div>
          ))}
        </section>
        <div className="toolbar">
          <Tabs value={view} onValueChange={(v) => setView(String(v))}>
            <TabsList aria-label="Вид пространства">
              <TabsTrigger value="board">
                <LayoutGrid />
                Доска откликов
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <ChartNoAxesCombined />
                Аналитика
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="toolbar-right">
            {view === 'board' && (
              <>
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Поиск вакансий"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Компания, должность, навык"
                  />
                  {query && (
                    <button
                      aria-label="Очистить поиск"
                      onClick={() => setQuery('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <StageSelect
                  all
                  value={filter}
                  onChange={setFilter}
                  label="Фильтр по этапу"
                />
              </>
            )}
            {!demo && (
              <button
                className="icon-button"
                aria-label="Обновить вакансии"
                onClick={() => void reload()}
                disabled={saving || loading}
              >
                <RotateCw size={17} />
              </button>
            )}
          </div>
        </div>
        <div className="mode-row">
          <div className="demo-note">
            <BriefcaseBusiness size={17} />
            {demo
              ? 'Демо · Компании вымышлены. Изменения сбросятся после перезагрузки.'
              : 'Личные вакансии · Изменения сохраняются на сервере'}
          </div>
          {signedIn && (
            <button
              className="text-button"
              onClick={() => changeMode(!demo)}
              disabled={saving || loading}
            >
              {demo ? 'Вернуться к моим вакансиям' : 'Посмотреть демо'}
            </button>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="text-button" onClick={() => void reload()}>
              Повторить загрузку
            </button>
          </div>
        )}
        {notice && (
          <output className="notice">
            <Check size={16} />
            {notice}
          </output>
        )}
        {loading || !loaded ? (
          <div className="stats" aria-label="Загрузка вакансий">
            {[0, 1, 2, 3].map((i) => (
              <div className="stat" key={i}>
                <Skeleton className="h-40 w-full" />
              </div>
            ))}
          </div>
        ) : !error && view === 'board' ? (
          <>
            {jobs.length === 0 ? (
              <Empty className="welcome">
                <div className="empty-icon">
                  <BriefcaseBusiness size={27} />
                </div>
                <EmptyTitle>Начни с одной возможности</EmptyTitle>
                <EmptyDescription>
                  Добавь вакансию, которая заинтересовала. Отслеживай отклик и
                  готовься к следующему шагу.
                </EmptyDescription>
                <button className="primary" onClick={() => create()}>
                  <Plus size={17} />
                  Добавить первую вакансию
                </button>
                {signedIn && (
                  <button
                    className="text-button"
                    onClick={() => changeMode(true)}
                  >
                    Сначала посмотреть пример
                  </button>
                )}
              </Empty>
            ) : matches.length === 0 ? (
              <Empty>
                <EmptyTitle>Ничего не найдено</EmptyTitle>
                <EmptyDescription>
                  Попробуй другую компанию, должность или навык.
                </EmptyDescription>
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Сбросить фильтры
                </button>
              </Empty>
            ) : (
              <div className="board-scroll">
                <section
                  className={`board ${filter !== 'all' ? 'filtered-board' : ''}`}
                >
                  {stages
                    .filter((s) => filter === 'all' || s === filter)
                    .map((stage) => {
                      const index = stages.indexOf(stage);
                      const cards = matches.filter((j) => j.stage === stage);
                      return (
                        <section
                          className="column"
                          key={stage}
                          onDragOver={(e) => {
                            if (!saving) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            void move(
                              e.dataTransfer.getData('text/plain'),
                              stage,
                            );
                          }}
                        >
                          <h2>
                            <span className={`dot dot-${index}`} />
                            {labels[stage]}
                            <span className="count">{cards.length}</span>
                          </h2>
                          {cards.map((job) => (
                            // Drag is an enhancement; the card button opens a keyboard-accessible stage selector.
                            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                            <article
                              className="job-card"
                              key={job.id}
                              draggable={!saving}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', job.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                              <button
                                className="card-open"
                                onClick={() => edit(job)}
                                disabled={saving}
                                aria-label={`Открыть ${job.title}, ${job.company}`}
                              >
                                <div className="company-line">
                                  <span
                                    className={`company-logo logo-${index % 4}`}
                                  >
                                    {job.company.slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="company-name">
                                    {job.company}
                                    <small>
                                      {job.location || 'Место не указано'}
                                    </small>
                                  </span>
                                </div>
                                <h3>{job.title}</h3>
                                <p className="salary">
                                  {job.salary || 'Зарплата не указана'}
                                </p>
                                <div className="tags">
                                  {job.skills.slice(0, 3).map((s) => (
                                    <span key={s}>{s}</span>
                                  ))}
                                  {job.skills.length > 3 && (
                                    <span>+{job.skills.length - 3}</span>
                                  )}
                                </div>
                                <footer>
                                  {job.interviewDate &&
                                  job.stage === 'interview' ? (
                                    <span className="interview-label">
                                      <CalendarDays size={13} />
                                      {dateLabel(job.interviewDate)} ·
                                      Собеседование
                                    </span>
                                  ) : (
                                    <>Добавлено {dateLabel(job.createdAt)}</>
                                  )}
                                </footer>
                              </button>
                            </article>
                          ))}
                          <button
                            className="column-add"
                            onClick={() => create(stage)}
                            disabled={saving}
                          >
                            <Plus size={15} />
                            Добавить
                          </button>
                        </section>
                      );
                    })}
                </section>
              </div>
            )}
            {jobs.length > 0 && (
              <p className="board-hint">
                Перетащи карточку в другой этап или измени его внутри карточки.
              </p>
            )}
          </>
        ) : (
          !error && (
            <section className="analytics-grid">
              <article className="analytics-card">
                <p className="eyebrow">НАВЫКИ В ВАКАНСИЯХ</p>
                <h2>Что пригодится в работе</h2>
                <p>
                  Частота навыков среди всех {all.total} вакансий. Учитываются
                  навыки, указанные в карточках.
                </p>
                {all.skills.length ? (
                  all.skills.slice(0, 12).map((s) => (
                    <div className="skill-row" key={s.name}>
                      <div>
                        <strong>{s.name}</strong>
                        <span>
                          {s.count} из {all.total}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          style={{ width: `${(s.count / all.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">
                    Добавь навыки в карточки — здесь появится статистика.
                  </p>
                )}
              </article>
              <div>
                <article className="analytics-card conversion">
                  <p className="eyebrow">ОТ ОТКЛИКА К СОБЕСЕДОВАНИЮ</p>
                  <strong className="big-number">
                    {all.conversion}
                    <span>%</span>
                  </strong>
                  <p>
                    {all.interviews} из {all.applied} откликов дошли до
                    собеседования или оффера.
                  </p>
                  <small>
                    Расчёт по текущим этапам и истории. Прямой переход в «Оффер»
                    учитывается как прохождение интервью, в «Отказ» — как
                    отправленный отклик.
                  </small>
                </article>
                <article className="analytics-card upcoming">
                  <h2>
                    <CalendarDays size={19} />
                    Ближайшие собеседования
                  </h2>
                  {upcoming.length ? (
                    upcoming.map((j) => (
                      <button key={j.id} onClick={() => edit(j)}>
                        <span>
                          <strong>{j.company}</strong>
                          <small>{j.title}</small>
                        </span>
                        <span>{dateLabel(j.interviewDate)}</span>
                      </button>
                    ))
                  ) : (
                    <p>
                      Пока нет запланированных встреч. Дату можно указать в
                      карточке вакансии.
                    </p>
                  )}
                </article>
              </div>
            </section>
          )
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!saving) setOpen(v);
        }}
      >
        <DialogContent className="job-dialog" showCloseButton={false}>
          <DialogClose
            className="dialog-x"
            aria-label="Закрыть карточку"
            disabled={saving}
          >
            <X size={20} />
          </DialogClose>
          <DialogTitle className="dialog-title">
            {editing ? 'Карточка вакансии' : 'Новая возможность'}
          </DialogTitle>
          <DialogDescription>
            {demo
              ? 'Деморежим: данные не сохраняются после перезагрузки.'
              : 'Компания и должность обязательны. Остальное можно заполнить позже.'}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={saving} className="form-fields">
              <div className="form-grid">
                <label>
                  Компания *
                  <input
                    required
                    maxLength={120}
                    value={form.company}
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                    placeholder="Название компании"
                  />
                </label>
                <label>
                  Должность *
                  <input
                    required
                    maxLength={180}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Frontend-разработчик"
                  />
                </label>
                <div className="field-label">
                  Этап
                  <StageSelect
                    value={form.stage}
                    onChange={(v) => setForm({ ...form, stage: v as Stage })}
                  />
                </div>
                <label>
                  Зарплата
                  <input
                    maxLength={120}
                    value={form.salary}
                    onChange={(e) =>
                      setForm({ ...form, salary: e.target.value })
                    }
                    placeholder="120 000 – 180 000 ₽"
                  />
                </label>
                <label>
                  Место и формат
                  <input
                    maxLength={160}
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Москва · Удалённо"
                  />
                </label>
                <label>
                  Дата собеседования
                  <input
                    type="date"
                    value={form.interviewDate}
                    onChange={(e) =>
                      setForm({ ...form, interviewDate: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Ссылка на вакансию
                <div className="url-field">
                  <input
                    type="url"
                    maxLength={2048}
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://…"
                  />
                  {/^https?:\/\//i.test(form.url) && (
                    <a
                      className="icon-button"
                      href={form.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Открыть исходную вакансию"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>
              </label>
              <label>
                Навыки через запятую
                <input
                  maxLength={1800}
                  value={skillText}
                  onChange={(e) => setSkillText(e.target.value)}
                  placeholder="React, TypeScript, Git"
                />
              </label>
              <label>
                Описание вакансии
                <textarea
                  rows={4}
                  maxLength={20000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Вставь текст вакансии: задачи, требования, условия"
                />
              </label>
              <label>
                Мои заметки
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Что уточнить у рекрутера, к чему подготовиться"
                />
              </label>
              {editing && (
                <details className="history">
                  <summary>
                    История изменений · {editing.history.length}
                  </summary>
                  {[...editing.history].reverse().map((h, i) => (
                    <p key={i}>
                      <span>
                        {dateLabel(h.at)} ·{' '}
                        {new Date(h.at).toLocaleTimeString('ru', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {h.action} · {labels[h.stage]}
                    </p>
                  ))}
                </details>
              )}
            </fieldset>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-footer">
              {editing && (
                <button
                  type="button"
                  className="delete-button"
                  aria-label="Удалить вакансию"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Отмена
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving
                  ? 'Сохраняем…'
                  : editing
                    ? 'Сохранить изменения'
                    : 'Добавить вакансию'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(v) => {
          if (!saving) setConfirmDelete(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Удалить вакансию?</AlertDialogTitle>
          <AlertDialogDescription>
            «{editing?.title}» в {editing?.company} и её история будут удалены
            без возможности восстановления.
          </AlertDialogDescription>
          <div className="form-footer">
            <AlertDialogCancel disabled={saving}>Отмена</AlertDialogCancel>
            <button
              className="primary danger"
              disabled={saving}
              onClick={() => void remove()}
            >
              {saving ? 'Удаляем…' : 'Удалить'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
