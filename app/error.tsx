'use client';

import Link from '@/components/joblens/site-link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('JobLens page failed', error);
  }, [error]);

  return (
    <main className="status-page">
      <div className="status-card">
        <p className="eyebrow">ОШИБКА ЗАГРУЗКИ</p>
        <h1>Страница не открылась</h1>
        <p>
          Попробуйте загрузить её ещё раз. Если ошибка повторится, откройте
          демонстрационное пространство — оно не использует личные данные.
        </p>
        <div className="status-actions">
          <button className="primary" onClick={reset}>
            Повторить
          </button>
          <Link className="secondary" href="/demo">
            Открыть демо
          </Link>
        </div>
      </div>
    </main>
  );
}
