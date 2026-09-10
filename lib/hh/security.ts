const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoded value');
  return Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
}
export const randomSecret = () =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string): Promise<string> {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}
export function validEncryptionKey(value: string): boolean {
  try {
    return decode(value).length === 32;
  } catch {
    return false;
  }
}
async function key(secret: string) {
  if (!validEncryptionKey(secret))
    throw new Error('Encryption key must contain 32 random bytes');
  return crypto.subtle.importKey(
    'raw',
    decode(secret),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encrypt(
  value: string,
  secret: string,
  owner: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(owner) },
    await key(secret),
    encoder.encode(value),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(bytes))}`;
}
export async function decrypt(
  value: string,
  secret: string,
  owner: string,
): Promise<string> {
  const [version, iv, data, ...extra] = value.split('.');
  if (version !== 'v1' || !iv || !data || extra.length)
    throw new Error('Invalid ciphertext');
  const result = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(owner) },
    await key(secret),
    decode(data),
  );
  return new TextDecoder().decode(result);
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export function stateCookie(request: Request): string | null {
  const entries = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((v) => v.trim());
  return (
    entries
      .find((v) => v.startsWith('joblens_hh_state='))
      ?.slice('joblens_hh_state='.length) ?? null
  );
}
export function cookie(
  value: string,
  redirectUri: string,
  maxAge = 600,
): string {
  return `joblens_hh_state=${value}; Path=/api/hh/callback; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(redirectUri).protocol === 'https:' ? '; Secure' : ''}`;
}
