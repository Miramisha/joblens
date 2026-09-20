export type MailSettings = {
  provider?: 'resend' | 'smtp2go';
  apiKey: string;
  from: string;
};
export async function sendCode(
  settings: MailSettings,
  email: string,
  code: string,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (settings.provider === 'smtp2go') {
    const response = await fetcher('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': settings.apiKey,
      },
      body: JSON.stringify({
        sender: settings.from,
        to: [email],
        subject: 'Код входа в JobLens',
        text_body: `Ваш код активации JobLens: ${code}\n\nВведите его на сайте, чтобы подтвердить почту и войти. Код действует 5 минут и может быть использован только один раз.\n\nЕсли вы не запрашивали вход, просто проигнорируйте письмо. Никому не сообщайте код.`,
        fastaccept: false,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery failed');
    const result = (await response.json().catch(() => null)) as {
      data?: {
        succeeded?: number;
        failed?: number;
        error?: unknown;
        failures?: unknown[];
      };
    } | null;
    if (
      result?.data?.succeeded !== 1 ||
      result.data.failed !== 0 ||
      result.data.error ||
      (result.data.failures && result.data.failures.length > 0)
    ) {
      throw new Error('Email delivery failed');
    }
    return;
  }
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
      text: `Ваш код активации JobLens: ${code}\n\nВведите его на сайте, чтобы подтвердить почту и войти. Код действует 5 минут и может быть использован только один раз.\n\nЕсли вы не запрашивали вход, просто проигнорируйте письмо. Никому не сообщайте код.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Email delivery failed');
}
