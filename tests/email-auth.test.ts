import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  generateCode,
  codeHash,
  authCookie,
  readCookie,
} from '../lib/auth/security.ts';
import { sendCode } from '../lib/auth/mail.ts';
void test('normalizes emails without merging provider aliases; rejects malformed inputs', () => {
  assert.equal(
    normalizeEmail(' USER+jobs@Example.com '),
    'user+jobs@example.com',
  );
  for (const value of [
    null,
    {},
    'a@b',
    'a..b@example.com',
    '.a@example.com',
    'a.@example.com',
    'a@-bad.com',
    'a@b.com\nBcc: victim@example.com',
    'a'.repeat(65) + '@example.com',
  ])
    assert.equal(normalizeEmail(value), null);
});
void test('codes have six digits; hashes bind the challenge and secret', async () => {
  for (let i = 0; i < 100; i++) assert.match(generateCode(), /^\d{6}$/);
  const hash = await codeHash('secret', 'challenge', '123456');
  assert.equal(hash, await codeHash('secret', 'challenge', '123456'));
  assert.notEqual(hash, await codeHash('secret', 'other', '123456'));
  assert.notEqual(hash, await codeHash('other', 'challenge', '123456'));
});
void test('cookies reject ambiguous or malformed tokens, secure HTTPS, and clear sessions', () => {
  const token = 'a'.repeat(43);
  assert.equal(
    readCookie(`joblens_session=${token}`, 'joblens_session'),
    token,
  );
  assert.equal(
    readCookie(
      `joblens_session=${token}; joblens_session=${token}`,
      'joblens_session',
    ),
    null,
  );
  assert.equal(readCookie('joblens_session=forged', 'joblens_session'), null);
  const cookie = authCookie(
    'joblens_session',
    token,
    'https://joblens.test',
    3600,
  );
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  assert.match(cookie, /; Secure$/);
  assert.match(
    authCookie('joblens_session', '', 'http://localhost:3000', 0),
    /Max-Age=0$/,
  );
});
void test('Resend receives a transactional code with a stable idempotency key', async () => {
  await sendCode(
    { apiKey: 'test-key', from: 'JobLens <login@example.com>' },
    'user@example.com',
    '001234',
    'challenge',
    async (url, init) => {
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(init?.method, 'POST');
      const h = new Headers(init?.headers);
      assert.equal(h.get('Authorization'), 'Bearer test-key');
      assert.equal(h.get('Idempotency-Key'), 'joblens-login/challenge');
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.to, ['user@example.com']);
      assert.match(body.text, /001234/);
      assert.match(body.text, /10 минут/);
      return Response.json({ id: 'test' });
    },
  );
});
void test('mail provider failures are not treated as successful delivery', async () => {
  await assert.rejects(
    sendCode(
      { apiKey: 'test', from: 'test@example.com' },
      'a@example.com',
      '123456',
      'id',
      async () => new Response('private provider detail', { status: 403 }),
    ),
    /Email delivery failed/,
  );
});
