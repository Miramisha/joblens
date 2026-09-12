'use client';
import { useState } from 'react';
import Link from 'next/link';
import { UserRound, Link2, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
export default function AccountPanel({
  initialName,
  email,
  registered,
  connection,
}: {
  initialName: string;
  email: string;
  registered: boolean;
  connection: {
    display_name: string;
    connected_at: string;
    expires_at: number;
  } | null;
}) {
  const [name, setName] = useState(initialName.slice(0, 80)),
    [exists, setExists] = useState(registered),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [confirm, setConfirm] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw Error(data.error);
      setExists(true);
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Не удалось сохранить профиль.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-grid">
      <section className="account-card">
        <div className="account-section-title">
          <UserRound size={21} />
          <h2>{exists ? 'Мой профиль' : 'Создать профиль'}</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="account-field">
            Имя в JobLens
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              maxLength={80}
              required
              autoComplete="name"
              disabled={busy}
            />
          </label>
          <div className="account-email">
            <span>Аккаунт для входа</span>
            <strong>{email}</strong>
            <small>Почта подтверждена</small>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <output className="account-success">Профиль сохранён.</output>
          )}
          <button className="primary" disabled={busy || !name.trim()}>
            {busy
              ? 'Сохраняем…'
              : exists
                ? 'Сохранить имя'
                : 'Создать профиль JobLens'}
          </button>
        </form>
      </section>
      <section className="account-card">
        <div className="account-section-title">
          <Link2 size={21} />
          <h2>Вакансии hh.ru</h2>
        </div>
        <p>
          На доске можно найти вакансию hh.ru или загрузить её по ссылке.
          Отмечай этапы отклика в JobLens — они попадут в твою статистику.
        </p>
        <div className="connection-info">
          Синхронизация личного профиля недоступна: hh.ru прекратил поддержку
          API для соискателей. Доступ к открытым вакансиям также может
          ограничиваться со стороны hh.ru.
        </div>
        <Link className="primary" href="/">
          Перейти к доске
        </Link>
        {connection && (
          <div className="connection-actions">
            <p>
              Сохранён прежний доступ к профилю {connection.display_name}. Его
              можно удалить.
            </p>
            <button className="secondary" onClick={() => setConfirm(true)}>
              Отключить
            </button>
          </div>
        )}
        <p className="account-security">
          <ShieldCheck size={17} />
          Личные вакансии и заметки доступны только в твоём аккаунте.
        </p>
      </section>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Отключить hh.ru?</AlertDialogTitle>
          <AlertDialogDescription>
            JobLens удалит сохранённый доступ к профилю. Твои вакансии и заметки
            останутся.
          </AlertDialogDescription>
          <div className="form-footer">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <form method="post" action="/api/hh/disconnect" target="_top">
              <button className="primary danger">Отключить hh.ru</button>
            </form>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
