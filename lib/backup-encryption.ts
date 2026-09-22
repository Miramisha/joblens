/** Only the public key lives on the server. Private keys never enter a backup. */
export async function encryptBackup(data: unknown, publicKeyPem: string) {
  const der = Uint8Array.from(atob(publicKeyPem.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode('joblens-encrypted-backup:v1');
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext);
  const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, await crypto.subtle.exportKey('raw', key));
  const base64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64');
  return { format: 'joblens-encrypted-backup', version: 1, algorithm: 'RSA-OAEP-256+A256GCM', iv: base64(iv), wrappedKey: base64(wrappedKey), ciphertext: base64(ciphertext) };
}
