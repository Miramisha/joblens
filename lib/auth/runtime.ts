import type { MailSettings } from './mail';
import { normalizeEmail } from './security';
import { env } from 'cloudflare:workers';
import { validEncryptionKey } from '@/lib/hh/security';
export function getAuthSettings(): (MailSettings & { secret: string }) | null {
  const provider = env.EMAIL_PROVIDER?.trim() || 'resend';
  if (provider !== 'resend' && provider !== 'smtp2go') return null;
  const apiKey = (
    provider === 'smtp2go' ? env.SMTP2GO_API_KEY : env.RESEND_API_KEY
  )?.trim();
  if (
    !env.AUTH_SECRET ||
    !validEncryptionKey(env.AUTH_SECRET) ||
    !apiKey ||
    !env.EMAIL_FROM?.trim()
  )
    return null;
  return {
    secret: env.AUTH_SECRET,
    provider,
    apiKey,
    from: env.EMAIL_FROM,
  };
}

export function allowedLoginEmail(): string | null {
  return normalizeEmail(env.ALLOWED_LOGIN_EMAIL);
}
