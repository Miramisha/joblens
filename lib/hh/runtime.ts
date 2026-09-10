import { env } from 'cloudflare:workers';
import { settings } from './client';
export const getHHSettings = () =>
  settings(env as unknown as Record<string, unknown>);
