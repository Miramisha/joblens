'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
export default function EmailLogin({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!countdown) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  async function submit(verify: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/auth/${verify ? 'verify-code' : 'send-code'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verify ? { code } : { email }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || 'Не удалось выполнить запрос.');
      if (verify) {
        window.location.assign('/account');
        return;
      }
      setSent(true);
      setCode('');
      setCountdown(60);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Проверьте соединение и попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-card login-card">
      <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
      <h1>{sent ? 'Проверь свою почту' : 'Твой аккаунт JobLens'}</h1>
      <p>
        {sent ? (
          <>
            Отправили код на <strong className="login-email">{email}</strong>.
            Введи его ниже, чтобы подтвердить почту и войти.
          </>
        ) : (
          'Введи почту — мы пришлём код для входа. Если ты здесь впервые, аккаунт создастся после подтверждения. Пароль не нужен.'
        )}
      </p>
      {!configured && (
        <output className="account-message">
          Вход по почте скоро появится. Пока можно познакомиться с JobLens в
          демо.
        </output>
      )}
      <form
        className="email-login-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(sent);
        }}
      >
        {sent ? (
          <label htmlFor="login-code">
            Код из письма
            <InputOTP
              id="login-code"
              maxLength={6}
              pattern="^[0-9]*$"
              value={code}
              onChange={setCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Шестизначный код из письма"
              disabled={busy}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="email-code-slot"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </label>
        ) : (
          <label htmlFor="login-email">
            Электронная почта
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || !configured}
            />
          </label>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button
          className="primary"
          disabled={busy || !configured || (sent && code.length !== 6)}
        >
          {busy ? 'Подождите…' : sent ? 'Подтвердить и войти' : 'Получить код'}
        </button>
      </form>
      {sent && (
        <>
          <small>
            Код действует 5 минут. Если письма нет, проверь папку «Спам».
          </small>
          <div className="email-login-actions">
            <button
              className="text-button"
              disabled={busy || countdown > 0}
              onClick={() => void submit(false)}
            >
              {countdown > 0
                ? `Повторить через ${countdown} с`
                : 'Отправить новый код'}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode('');
                setError('');
              }}
            >
              Изменить почту
            </button>
          </div>
        </>
      )}
      <Link className="text-button" href="/demo">
        Посмотреть демо
      </Link>
    </section>
  );
}
