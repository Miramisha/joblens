import Link from 'next/link';
import {
  getChatGPTUser,
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { getHHSettings } from '@/lib/hh/runtime';
import AccountPanel from './panel';
export const dynamic = 'force-dynamic';
const messages: Record<string, string> = {
  connected: 'Профиль hh.ru подключён.',
  disconnected: 'Подключение удалено из JobLens.',
  denied: 'Вы отменили доступ к hh.ru. Подключение не изменено.',
  invalid_state:
    'Запрос подключения устарел или уже использован. Начните подключение заново.',
  failed: 'Подключение не удалось завершить. Попробуйте ещё раз.',
  not_applicant: 'Подключите профиль соискателя, а не работодателя.',
  already_linked:
    'Этот профиль hh.ru уже подключён к другому аккаунту JobLens.',
  not_configured: 'Подключение hh.ru пока не настроено владельцем сайта.',
  account_required: 'Сначала создайте профиль JobLens.',
  login_required: 'Войдите в тот же аккаунт JobLens и повторите подключение.',
  disconnected_local:
    'Подключение удалено из JobLens. Отозвать разрешение также можно в настройках hh.ru.',
};
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ hh?: string }>;
}) {
  // This dynamic Server Component computes expiry once per HTTP request.
  // oxlint-disable-next-line react/react-compiler
  const checkedAt = Math.floor(Date.now() / 1000);
  const user = await getChatGPTUser();
  const params = await searchParams;
  if (!user)
    return (
      <main className="account-page">
        <Link className="account-back" href="/">
          JobLens
        </Link>
        <section className="account-card login-card">
          <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
          <h1>Твой аккаунт JobLens</h1>
          <p>
            Войди через ChatGPT, создай профиль и подключи hh.ru. Вакансии и
            подключения будут доступны только тебе.
          </p>
          <a
            className="primary"
            href={chatGPTSignInPath('/account')}
            target="_top"
          >
            Войти или зарегистрироваться через ChatGPT
          </a>
          <small>Пароль от ChatGPT или hh.ru не передаётся JobLens.</small>
          <Link className="text-button" href="/">
            Посмотреть демо
          </Link>
        </section>
      </main>
    );
  let account: null | { display_name: string; created_at: string } = null,
    connection: null | {
      display_name: string;
      connected_at: string;
      expires_at: number;
    } = null,
    loadError = false;
  try {
    const db = getDb();
    [account, connection] = await Promise.all([
      db
        .prepare(
          'SELECT display_name,created_at FROM accounts WHERE owner_id=?',
        )
        .bind(user.userId)
        .first<{ display_name: string; created_at: string }>(),
      db
        .prepare(
          'SELECT display_name,connected_at,expires_at FROM hh_connections WHERE owner_id=?',
        )
        .bind(user.userId)
        .first<{
          display_name: string;
          connected_at: string;
          expires_at: number;
        }>(),
    ]);
  } catch {
    loadError = true;
  }
  return (
    <main className="account-page">
      <div className="account-top">
        <Link className="account-back" href="/">
          JobLens
        </Link>
        <a className="text-button" href={chatGPTSignOutPath('/')} target="_top">
          Выйти
        </a>
      </div>
      <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
      <h1>Профиль и подключения</h1>
      <p className="subtitle">Управляй своим аккаунтом и источниками данных.</p>
      {params.hh && messages[params.hh] && (
        <output className="account-message">{messages[params.hh]}</output>
      )}
      {loadError ? (
        <div className="error">
          Не удалось загрузить аккаунт. Обновите страницу и попробуйте ещё раз.
        </div>
      ) : (
        <AccountPanel
          initialName={account?.display_name ?? user.displayName}
          email={user.email}
          registered={!!account}
          configured={!!getHHSettings()}
          connection={connection}
          expired={!!connection && connection.expires_at <= checkedAt}
        />
      )}
    </main>
  );
}
