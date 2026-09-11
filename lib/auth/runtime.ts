import { env } from 'cloudflare:workers';
import { validEncryptionKey } from '@/lib/hh/security';
export function getAuthSettings() {
  if (
    !env.AUTH_SECRET ||
    !validEncryptionKey(env.AUTH_SECRET) ||
    !env.RESEND_API_KEY?.trim() ||
    !env.EMAIL_FROM?.trim()
  )
    return null;
  return {
    secret: env.AUTH_SECRET,
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  };
}
