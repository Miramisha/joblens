'use client';
import { useEffect, useRef, useState } from 'react';
import { readBackupFile } from '@/lib/backup-file-reader';
export default function RestoreAccount({ email }: { email: string }) {
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  const [reading, setReading] = useState(false);
  const [text, setText] = useState(''),
    [count, setCount] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState('');
  return (
    <section className="account-card">
      <h2>Восстановление из копии</h2>
      <p>
        Выбери JSON-файл JobLens для своей почты, до 5 МБ. Имя и навыки будут
        заменены данными из копии. Недостающие вакансии добавятся с историей;
        существующие сохранятся. Вход и подключения восстанавливаются отдельно.
        На доске доступно до 4 МБ данных, включая историю; на одну карточку — до
        1 МБ.
      </p>
      <label>
        Файл копии
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setText('');
            setError('');
            setResult('');
            setReading(!!file);
            const result = await readBackupFile(file, email, sequence);
            if (result.status === 'stale') return;
            setReading(false);
            if (result.status === 'ready') {
              setCount(result.count);
              setText(result.text);
            } else if (result.status === 'error') setError(result.error);
          }}
        />
      </label>
      {reading && <output>Читаем копию…</output>}
      {text && (
        <p>
          В копии {count} вакансий. Нажатие кнопки заменит имя и навыки профиля
          и добавит недостающие вакансии.
        </p>
      )}
      <button
        className="secondary"
        disabled={!text || busy || reading}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/account/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: text,
            });
            const data = (await response.json()) as {
              error?: string;
              imported: number;
              skipped: number;
            };
            if (!response.ok)
              throw Error(data.error || 'Не удалось восстановить копию.');
            setResult(
              `Добавлено: ${data.imported}. Уже сохранено: ${data.skipped}. Обнови страницу, чтобы увидеть восстановленный профиль.`,
            );
            setText('');
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Не удалось восстановить копию.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Восстанавливаем…' : 'Подтвердить восстановление'}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && <output className="account-success">{result}</output>}
    </section>
  );
}
