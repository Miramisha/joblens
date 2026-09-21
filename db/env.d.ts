declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MAINTENANCE_SECRET?: string;
    AUTH_SECRET?: string;
    EMAIL_PROVIDER?: string;
    SMTP2GO_API_KEY?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    HH_CLIENT_ID?: string;
    HH_CLIENT_SECRET?: string;
    HH_REDIRECT_URI?: string;
    HH_USER_AGENT?: string;
    TOKEN_ENCRYPTION_KEY?: string;
  }
}
