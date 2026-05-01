import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'server-only';
import {
  getSupabaseAnonKey,
  getSupabaseJwtSecret,
  getSupabaseUrl,
} from '@/env';

const TOKEN_TTL_SECONDS = 5 * 60;

export function createAgenticScopedSupabaseClient({
  merchantId,
  merchantSlug,
  now = new Date(),
}: {
  merchantId: string;
  merchantSlug: string;
  now?: Date;
}) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const token = signJwt(
    {
      agentic_context: 'checkout',
      agentic_merchant_id: merchantId,
      agentic_merchant_slug: merchantSlug,
      aud: 'authenticated',
      exp: issuedAt + TOKEN_TTL_SECONDS,
      iat: issuedAt,
      role: 'authenticated',
      sub: merchantId,
    },
    getSupabaseJwtSecret()
  );

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}
