import { readFileSync, writeFileSync } from 'node:fs';
import { constants, privateDecrypt, createDecipheriv } from 'node:crypto';
export function decryptBackup(envelope, privateKey) {
  if (envelope.format !== 'joblens-encrypted-backup' || envelope.version !== 1 || envelope.algorithm !== 'RSA-OAEP-256+A256GCM') throw Error('Unsupported backup');
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(envelope.wrappedKey, 'base64'));
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from('joblens-encrypted-backup:v1'));
  decipher.setAuthTag(ciphertext.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString('utf8'));
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const [, , input, key, output] = process.argv;
    if (!input || !key || !output) throw Error('Usage');
    const data = decryptBackup(JSON.parse(readFileSync(input, 'utf8')), readFileSync(key));
    writeFileSync(output, JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(data.format === 'joblens-empty-account-snapshot' ? 'Empty snapshot: no owner account existed at backup time. Nothing to restore.' : 'Backup decrypted. Restore this JSON from your JobLens account.');
  } catch { console.error('Cannot decrypt backup. Check file, key and unused output path.'); process.exitCode = 1; }
}
