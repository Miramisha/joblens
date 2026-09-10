import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  randomSecret,
  digest,
  encrypt,
  decrypt,
  validEncryptionKey,
  sameOrigin,
  cookie,
} from '../lib/hh/security.ts';
import {
  settings,
  authorizeUrl,
  exchangeCode,
  currentProfile,
  revokeToken,
  type HHSettings,
} from '../lib/hh/client.ts';
const config: HHSettings = {
  clientId: 'example-client',
  clientSecret: 'example-secret',
  redirectUri: 'https://joblens.example/api/hh/callback',
  userAgent: 'JobLens test (test@example.test)',
  encryptionKey: randomSecret(),
};
void test('PKCE matches the RFC 7636 SHA256 test vector', async () => {
  assert.equal(
    await digest('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
  assert.match(randomSecret(), /^[A-Za-z0-9_-]{43}$/);
});
void test('encrypted tokens bind to owner and reject tampering', async () => {
  const secret = randomSecret(),
    plaintext = 'access-and-refresh-token';
  const cipher = await encrypt(plaintext, secret, 'alice');
  assert.equal(await decrypt(cipher, secret, 'alice'), plaintext);
  assert.ok(!cipher.includes(plaintext));
  assert.notEqual(cipher, await encrypt(plaintext, secret, 'alice'));
  await assert.rejects(decrypt(cipher, secret, 'bob'));
  await assert.rejects(decrypt(cipher, randomSecret(), 'alice'));
  await assert.rejects(
    decrypt(cipher.slice(0, -8) + 'AAAAAAAA', secret, 'alice'),
  );
  assert.equal(validEncryptionKey('short'), false);
});
void test('config validates callback URL and missing secrets', () => {
  const env = {
    HH_CLIENT_ID: config.clientId,
    HH_CLIENT_SECRET: config.clientSecret,
    HH_REDIRECT_URI: config.redirectUri,
    HH_USER_AGENT: config.userAgent,
    TOKEN_ENCRYPTION_KEY: config.encryptionKey,
  };
  assert.deepEqual(settings(env), config);
  assert.equal(settings({}), null);
  for (const url of [
    'http://public.example/api/hh/callback',
    'https://joblens.example/other',
    'https://user:pass@joblens.example/api/hh/callback',
    'https://joblens.example/api/hh/callback?next=evil',
  ])
    assert.equal(settings({ ...env, HH_REDIRECT_URI: url }), null);
  assert.ok(
    settings({
      ...env,
      HH_REDIRECT_URI: 'http://localhost:3000/api/hh/callback',
    }),
  );
});
void test('OAuth URL includes state and PKCE but no client secret', () => {
  const url = new URL(authorizeUrl(config, 'state', 'challenge'));
  assert.equal(url.origin, 'https://hh.ru');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state');
  assert.equal(url.searchParams.get('role'), 'applicant');
  assert.ok(!url.toString().includes(config.clientSecret));
});
void test('same-origin writes and callback cookie flags', () => {
  assert.ok(
    sameOrigin(
      new Request('https://joblens.example/api/account', {
        headers: { Origin: 'https://joblens.example' },
      }),
    ),
  );
  assert.ok(
    !sameOrigin(
      new Request('https://joblens.example/api/account', {
        headers: { Origin: 'https://evil.example' },
      }),
    ),
  );
  assert.ok(!sameOrigin(new Request('https://joblens.example/api/account')));
  const header = cookie('state', config.redirectUri);
  for (const flag of [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/api/hh/callback',
    'Max-Age=600',
  ])
    assert.ok(header.includes(flag));
});
void test('code exchange uses server-side POST and parses token lifetime', async () => {
  const mock: typeof fetch = async (input, init) => {
    assert.equal(input, 'https://api.hh.ru/token');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.body instanceof URLSearchParams);
    const body = init.body;
    assert.equal(body.get('client_secret'), config.clientSecret);
    assert.equal(body.get('code_verifier'), 'verifier');
    return Response.json({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
    });
  };
  const tokens = await exchangeCode(config, 'code', 'verifier', mock);
  assert.equal(tokens.accessToken, 'access');
  assert.ok(tokens.expiresAt > Math.floor(Date.now() / 1000));
  const invalid: typeof fetch = async () =>
    Response.json({ access_token: 'access' });
  await assert.rejects(exchangeCode(config, 'code', 'verifier', invalid));
  const denied: typeof fetch = async () =>
    Response.json({ secret: 'must-not-leak' }, { status: 403 });
  await assert.rejects(exchangeCode(config, 'code', 'verifier', denied), {
    message: 'provider_error',
  });
});
void test('profile parsing rejects employer and avoids unnecessary personal fields', async () => {
  const mock: typeof fetch = async (input, init) => {
    assert.equal(input, 'https://api.hh.ru/me');
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer access',
    );
    return Response.json({
      id: '123',
      is_applicant: true,
      first_name: 'Иван',
      last_name: 'Иванов',
      email: 'private@example.test',
    });
  };
  assert.deepEqual(await currentProfile(config, 'access', mock), {
    id: '123',
    displayName: 'Иван Иванов',
  });
  const employer: typeof fetch = async () =>
    Response.json({ id: '123', is_applicant: false, is_employer: true });
  await assert.rejects(currentProfile(config, 'access', employer), {
    message: 'not_applicant',
  });
});

void test('disconnect requests provider revocation and tolerates provider failure', async () => {
  const success: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.hh.ru/token');
    assert.equal(init?.method, 'DELETE');
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer access',
    );
    return new Response(null, { status: 204 });
  };
  assert.equal(await revokeToken(config, 'access', success), true);
  const expired: typeof fetch = async () => new Response(null, { status: 403 });
  assert.equal(await revokeToken(config, 'access', expired), false);
  const offline: typeof fetch = async () => {
    throw new Error('network error');
  };
  assert.equal(await revokeToken(config, 'access', offline), false);
});
