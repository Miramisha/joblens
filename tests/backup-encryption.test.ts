import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { encryptBackup } from '../lib/backup-encryption.ts';
import { decryptBackup } from '../scripts/decrypt-backup.mjs';
void test('encrypted backup restores only with its private key and detects tampering', async () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const data = { profile: { email: 'owner@example.test' }, jobs: [{ notes: 'private notes' }] };
  const encrypted = await encryptBackup(data, keys.publicKey);
  assert.ok(!JSON.stringify(encrypted).includes('private notes'));
  assert.deepEqual(decryptBackup(encrypted, keys.privateKey), data);
  assert.notEqual((await encryptBackup(data, keys.publicKey)).ciphertext, encrypted.ciphertext);
  const altered = Buffer.from(encrypted.ciphertext, 'base64'); altered[0] ^= 1;
  assert.throws(() => decryptBackup({ ...encrypted, ciphertext: altered.toString('base64') }, keys.privateKey));
  const wrong = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.throws(() => decryptBackup(encrypted, wrong));
});
