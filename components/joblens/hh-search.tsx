'use client';
import { useRef, useState } from 'react';
import Link from '@/components/joblens/site-link';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { vacancySourceNotes, type Vacancy } from '@/lib/hh/vacancies';
export function HHSearch({
  open,
  onClose,
  onSelect,
  onManual,
  signedIn,
  savedUrls,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (v: Vacancy) => void;
  onManual: (url: string) => void;
  signedIn: boolean;
  savedUrls: string[];
}) {
  const [query, setQuery] = useState(''),
    [url, setUrl] = useState(''),
    [items, setItems] = useState<Vacancy[]>([]),
    [searched, setSearched] = useState(false),
    [searchText, setSearchText] = useState(''),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(0),
    [found, setFound] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  function close() {
    controller.current?.abort();
    setBusy(false);
    setError('');
    onClose();
  }
  async function load(source?: string, nextPage = 0, text = query) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    if (!source) {
      setItems([]);
      setSearched(false);
    }
    try {
      const params = source
        ? new URLSearchParams({ url: source })
        : new URLSearchParams({ q: text, page: String(nextPage) });
      const r = await fetch('/api/hh/vacancies?' + params, {
        signal: current.signal,
      });
      const data = (await r.json()) as {
        error?: string;
        vacancy?: Vacancy;
        items?: Vacancy[];
        pages: number;
        found: number;
      };
      if (!r.ok) throw new Error(data.error || 'Ошибка загрузки.');
      if (current.signal.aborted) return;
      if (data.vacancy) {
        onSelect(data.vacancy);
        return;
      }
      setItems(data.items ?? []);
      setPage(nextPage);
      setPages(data.pages);
      setFound(data.found);
      setSearchText(text);
      setSearched(true);
    } catch (e) {
      if (!current.signal.aborted)
        setError(
          e instanceof Error ? e.message : 'Не удалось загрузить вакансии.',
        );
    } finally {
      if (controller.current === current) setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent className="job-dialog hh-dialog">
        <DialogTitle>Вакансии hh.ru</DialogTitle>
        <DialogDescription>
          Найди вакансию или вставь ссылку. Перед сохранением можно проверить и
          дополнить карточку.
        </DialogDescription>
        {!signedIn ? (
          <p>
            <Link href="/account">Войди по почте</Link>, чтобы загрузить
            вакансии в личное пространство.
          </p>
        ) : (
          <>
            <form
              className="hh-search-row"
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
            >
              <label htmlFor="hh-query">
                Должность или навык
                <input
                  id="hh-query"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setError('');
                  }}
                  placeholder="Frontend, Go, аналитик данных"
                  minLength={2}
                  maxLength={160}
                  required
                  disabled={busy}
                />
              </label>
              <button
                className="primary"
                disabled={busy || query.trim().length < 2}
              >
                Найти
              </button>
            </form>
            <form
              className="hh-search-row"
              onSubmit={(e) => {
                e.preventDefault();
                void load(url.trim());
              }}
            >
              <label htmlFor="hh-url">
                Ссылка на вакансию
                <input
                  id="hh-url"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError('');
                  }}
                  placeholder="https://hh.ru/vacancy/…"
                  maxLength={2048}
                  required
                  disabled={busy}
                />
              </label>
              <button className="secondary" disabled={busy || !url.trim()}>
                Заполнить по ссылке
              </button>
            </form>
            {busy && <output>Загружаем из hh.ru…</output>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="hh-alternatives">
              <a
                href={
                  'https://hh.ru/search/vacancy?' +
                  new URLSearchParams({ text: query })
                }
                target="_blank"
                rel="noreferrer"
              >
                Открыть поиск на hh.ru
              </a>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  close();
                  onManual(url.trim());
                }}
              >
                Заполнить вручную
              </button>
            </div>
            {searched && (
              <output>
                {found
                  ? `Найдено на hh.ru: ${found.toLocaleString('ru-RU')}`
                  : 'Ничего не найдено. Попробуй другую должность.'}
              </output>
            )}
            <div className="hh-results">
              {items.map((v) => (
                <article key={v.id}>
                  <h3>{v.title}</h3>
                  <p>
                    {v.company} · {v.location}
                  </p>
                  <strong>{v.salary || 'Зарплата не указана'}</strong>
                  {vacancySourceNotes(v) && (
                    <p
                      style={{
                        whiteSpace: 'pre-line',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {vacancySourceNotes(v)}
                    </p>
                  )}
                  <div className="hh-result-actions">
                    <a href={v.url} target="_blank" rel="noreferrer">
                      Подробнее на hh.ru
                    </a>
                    <button
                      className="secondary"
                      disabled={busy || savedUrls.includes(v.url)}
                      onClick={() => void load(v.url)}
                    >
                      {savedUrls.includes(v.url)
                        ? 'Уже на доске'
                        : 'Добавить на доску'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {searched && pages > 1 && (
              <div className="hh-pagination">
                <button
                  className="secondary"
                  disabled={busy || page === 0}
                  onClick={() => void load(undefined, page - 1, searchText)}
                >
                  Назад
                </button>
                <span>
                  {page + 1} / {pages}
                </span>
                <button
                  className="secondary"
                  disabled={busy || page + 1 >= pages}
                  onClick={() => void load(undefined, page + 1, searchText)}
                >
                  Дальше
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
