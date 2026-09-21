'use client';
import { useState } from 'react';
export default function ExportAccount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="account-card">
      <h2>Копия твоих данных</h2>
      <p>
        Скачай профиль, навыки, вакансии с заметками и полной историей откликов
        в формате JSON. Коды входа, сессии и ключи подключений не включаются.
      </p>
      <p>
        Это копия для хранения и просмотра. Восстановление аккаунта из этого
        файла пока не поддерживается.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/account/export', {
              cache: 'no-store',
            });
            if (!response.ok)
              throw new Error(
                response.status === 401
                  ? 'Сначала войдите в JobLens.'
                  : 'Не удалось скачать данные. Попробуйте ещё раз.',
              );
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `joblens-data-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Не удалось скачать данные.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Готовим файл…' : 'Скачать копию данных'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
