import { validEncryptionKey } from './security.ts';
export type HHSettings = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userAgent: string;
  encryptionKey: string;
};
export type HHTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export type HHProfile = { id: string; displayName: string };
export function settings(values: Record<string, unknown>): HHSettings | null {
  const keys = [
    'HH_CLIENT_ID',
    'HH_CLIENT_SECRET',
    'HH_REDIRECT_URI',
    'HH_USER_AGENT',
    'TOKEN_ENCRYPTION_KEY',
  ] as const;
  if (
    keys.some(
      (k) => typeof values[k] !== 'string' || !(values[k] as string).trim(),
    )
  )
    return null;
  const redirect = String(values.HH_REDIRECT_URI);
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    return null;
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api/hh/callback'
  )
    return null;
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    return null;
  if (!validEncryptionKey(String(values.TOKEN_ENCRYPTION_KEY))) return null;
  return {
    clientId: String(values.HH_CLIENT_ID),
    clientSecret: String(values.HH_CLIENT_SECRET),
    redirectUri: redirect,
    userAgent: String(values.HH_USER_AGENT),
    encryptionKey: String(values.TOKEN_ENCRYPTION_KEY),
  };
}
export function authorizeUrl(
  config: HHSettings,
  state: string,
  challenge: string,
): string {
  const url = new URL('https://hh.ru/oauth/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    role: 'applicant',
    force_role: 'true',
  }).toString();
  return url.toString();
}
export class HHError extends Error {
  kind: 'provider_error' | 'not_applicant' | 'invalid_response';
  constructor(kind: 'provider_error' | 'not_applicant' | 'invalid_response') {
    super(kind);
    this.kind = kind;
  }
}
export async function exchangeCode(
  config: HHSettings,
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch,
): Promise<HHTokens> {
  const response = await fetcher('https://api.hh.ru/token', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'HH-User-Agent': config.userAgent,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new HHError('provider_error');
  const data = (await response.json()) as Record<string, unknown>;
  if (
    typeof data.access_token !== 'string' ||
    typeof data.refresh_token !== 'string' ||
    !data.access_token ||
    !data.refresh_token ||
    data.token_type !== 'bearer' ||
    typeof data.expires_in !== 'number' ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  )
    throw new HHError('invalid_response');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}
export async function currentProfile(
  config: HHSettings,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<HHProfile> {
  const response = await fetcher('https://api.hh.ru/me', {
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${token}`,
      'HH-User-Agent': config.userAgent,
    },
  });
  if (!response.ok) throw new HHError('provider_error');
  const data = (await response.json()) as Record<string, unknown>;
  if (data.is_applicant !== true) throw new HHError('not_applicant');
  if (typeof data.id !== 'string' || !data.id)
    throw new HHError('invalid_response');
  const name = [data.first_name, data.last_name]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .trim()
    .slice(0, 200);
  return { id: data.id, displayName: name || 'Профиль соискателя' };
}

/** Best effort: local deletion must still succeed when hh.ru is unavailable. */
export async function revokeToken(
  config: HHSettings,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher('https://api.hh.ru/token', {
      method: 'DELETE',
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${token}`,
        'HH-User-Agent': config.userAgent,
      },
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
