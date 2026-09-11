export type MailSettings = { apiKey: string; from: string };
export async function sendCode(
  settings: MailSettings,
  email: string,
  code: string,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `joblens-login/${id}`,
    },
    body: JSON.stringify({
      from: settings.from,
      to: [email],
      subject: 'Код входа в JobLens',
      text: `Ваш код активации JobLens: ${code}\n\nВведите его на сайте, чтобы подтвердить почту и войти. Код действует 10 минут и может быть использован только один раз.\n\nЕсли вы не запрашивали вход, просто проигнорируйте письмо. Никому не сообщайте код.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Email delivery failed');
}
