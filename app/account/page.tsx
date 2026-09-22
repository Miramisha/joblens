import Link from '@/components/joblens/site-link';
import { getUser } from '@/app/auth';
import { getAuthSettings, allowedLoginEmail } from '@/lib/auth/runtime';
import EmailLogin from './email-login';
import { getDb } from '@/db';
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
  searchParams: Promise<{ hh?: string; deleted?: string }>;
}) {
  const user = await getUser();
  const params = await searchParams;
  if (!user)
    return (
      <main className="account-page">
        <Link className="account-back" href="/">
          JobLens
        </Link>
        {params.deleted === '1' && (
          <output className="account-success">
            Аккаунт удалён из JobLens.
          </output>
        )}
        <EmailLogin configured={!!getAuthSettings() && !!allowedLoginEmail()} />
      </main>
    );
  let account: null | {
      display_name: string;
      skills: string;
      created_at: string;
    } = null,
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
          'SELECT display_name,skills,created_at FROM accounts WHERE owner_id=?',
        )
        .bind(user.userId)
        .first<{ display_name: string; skills: string; created_at: string }>(),
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
        <form action="/api/auth/logout" method="post">
          <button className="text-button">Выйти</button>
        </form>
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
          initialSkills={account?.skills ?? ''}
          email={user.email}
          registered={!!account}
          connection={connection}
        />
      )}
    </main>
  );
}
