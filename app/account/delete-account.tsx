'use client';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
export default function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="account-card">
      <h2>Удаление аккаунта</h2>
      <p>
        Удалить профиль, вакансии, заметки и историю откликов из JobLens. Перед
        удалением можно сохранить вакансии в CSV на доске.
      </p>
      <button
        className="secondary danger"
        onClick={() => {
          setOpen(true);
          setConfirmation('');
          setError('');
        }}
      >
        Удалить аккаунт
      </button>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            Удалить аккаунт без возможности восстановления?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Все данные аккаунта в JobLens будут удалены, а вход на других
            устройствах завершится. Аккаунт на hh.ru и письма в почтовом ящике
            останутся. Разрешение JobLens на hh.ru при наличии можно отозвать в
            настройках hh.ru.
          </AlertDialogDescription>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const response = await fetch('/api/account/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: confirmation,
                    confirmation: 'DELETE',
                  }),
                });
                const data = await response.json() as { error?: string };
                if (!response.ok)
                  throw new Error(data.error || 'Не удалось удалить аккаунт.');
                window.location.assign('/account?deleted=1');
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : 'Не удалось удалить аккаунт.',
                );
                setBusy(false);
              }
            }}
          >
            <label>
              Введи свою почту для подтверждения
              <input
                type="email"
                required
                autoComplete="off"
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-footer">
              <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
              <button
                className="primary danger"
                disabled={busy || confirmation.trim().toLowerCase() !== email}
              >
                {busy ? 'Удаляем…' : 'Удалить навсегда'}
              </button>
            </div>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
