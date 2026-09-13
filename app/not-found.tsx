import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-card">
        <p className="eyebrow">СТРАНИЦА НЕ НАЙДЕНА</p>
        <h1>Здесь ничего нет</h1>
        <p>
          Адрес мог измениться. Вернитесь к своим вакансиям или откройте демо.
        </p>
        <div className="status-actions">
          <Link className="primary" href="/">
            На главную
          </Link>
          <Link className="secondary" href="/demo">
            Открыть демо
          </Link>
        </div>
      </div>
    </main>
  );
}
