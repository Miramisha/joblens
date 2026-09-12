'use client';
import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { blank, labels, type Job } from '@/lib/jobs';
import { CSV_BYTES, exportCSV, previewCSV } from '@/lib/job-csv';
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CSVTransfer({
  open,
  onClose,
  jobs,
  personal,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
  personal: boolean;
  onImported: (message: string) => void;
}) {
  const [csv, setCSV] = useState(''),
    [fileName, setFileName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false);
  const seq = useRef(0);
  let preview: ReturnType<typeof previewCSV> = [];
  try {
    if (csv) preview = previewCSV(csv, jobs);
  } catch {
    /* errors reported during file selection */
  }
  const valid = preview.filter((row) => row.job && !row.duplicate),
    invalid = preview.filter((row) => row.error),
    duplicates = preview.filter((row) => row.duplicate);
  async function read(file: File | undefined) {
    const current = ++seq.current;
    setCSV('');
    setError('');
    setFileName(file?.name ?? '');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > CSV_BYTES)
        throw Error('Файл должен быть не больше 2 МБ.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (current !== seq.current) return;
      previewCSV(text, jobs);
      setCSV(text);
    } catch (e) {
      if (current === seq.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Не удалось прочитать файл. Выберите CSV в кодировке UTF-8.',
        );
    } finally {
      if (current === seq.current) setReading(false);
    }
  }
  async function importFile() {
    if (busy || !valid.length || invalid.length) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = (await r.json()) as {
        error?: string;
        imported: number;
        skipped: number;
      };
      if (!r.ok)
        throw Error(data.error || 'Не удалось импортировать вакансии.');
      setCSV('');
      setFileName('');
      onImported(
        `Импортировано: ${data.imported}. Пропущено дубликатов: ${data.skipped}.`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить импорт.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) {
          seq.current++;
          setReading(false);
          onClose();
        }
      }}
    >
      <DialogContent className="job-dialog csv-dialog" showCloseButton={false}>
        <DialogClose
          className="dialog-x"
          disabled={busy}
          aria-label="Закрыть импорт и экспорт"
        >
          ×
        </DialogClose>
        <DialogTitle>Импорт и экспорт</DialogTitle>
        <DialogDescription>
          Переноси вакансии между JobLens и таблицей. CSV содержит текущие поля
          и этапы, без истории изменений.
        </DialogDescription>
        <div className="csv-export">
          <button
            className="secondary"
            disabled={!jobs.length || busy}
            onClick={() => download('joblens-vacancies.csv', exportCSV(jobs))}
          >
            Скачать доску · {jobs.length}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              download(
                'joblens-template.csv',
                exportCSV([
                  {
                    ...blank,
                    company: 'Пример компании',
                    title: 'Frontend-разработчик',
                    skills: ['React', 'TypeScript'],
                  },
                ]),
              )
            }
          >
            Скачать шаблон
          </button>
        </div>
        <section className="csv-import">
          <h3>Импорт из CSV</h3>
          <p>
            До 100 вакансий, 2 МБ, UTF-8. Разделитель — запятая или точка с
            запятой. Замени пример в шаблоне своими данными.
          </p>
          {!personal ? (
            <p className="connection-info">
              Для импорта перейди в личное пространство. Демодоску можно
              скачать.
            </p>
          ) : (
            <label className="csv-file">
              Выбрать CSV-файл
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy || reading}
                onChange={(e) => void read(e.target.files?.[0])}
              />
            </label>
          )}
          {reading && <output>Читаем файл…</output>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!!preview.length && (
            <>
              <h4>{fileName}</h4>
              <output className="csv-summary">
                К добавлению: {valid.length} · Дубликаты: {duplicates.length} ·
                Ошибки: {invalid.length}
              </output>
              <p>
                Дубликаты по ссылке, а без ссылки — по компании и должности,
                будут пропущены. Существующие карточки не перезаписываются.
              </p>
              <section className="csv-preview" aria-label="Предпросмотр CSV">
                <table>
                  <thead>
                    <tr>
                      <th>Строка</th>
                      <th>Вакансия</th>
                      <th>Результат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>
                          {row.job ? (
                            <>
                              <strong>{row.job.title}</strong>
                              <span>
                                {row.job.company} · {labels[row.job.stage]}
                              </span>
                            </>
                          ) : (
                            'Проверьте строку'
                          )}
                        </td>
                        <td>
                          {row.error ||
                            (row.duplicate
                              ? 'Пропустить дубликат'
                              : 'Добавить')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {!!invalid.length && (
                <p className="error">
                  Исправь ошибки в файле и выбери его снова. До этого ничего не
                  будет добавлено.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  reading ||
                  !valid.length ||
                  !!invalid.length ||
                  !personal
                }
                onClick={() => void importFile()}
              >
                {busy ? 'Импортируем…' : `Добавить вакансии · ${valid.length}`}
              </button>
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
