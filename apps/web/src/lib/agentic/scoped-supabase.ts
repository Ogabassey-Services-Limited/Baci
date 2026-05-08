import { Buffer } from 'node:buffer';
import { createHmac, sign as signWithPrivateKey } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'server-only';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import {
  type AgenticJwtSigningMaterial,
  getAgenticJwtSigningMaterial,
} from '@/lib/agentic/jwt-signing-material';

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
  if (!merchantId?.trim() || !merchantSlug?.trim()) {
    throw new Error('Agentic merchant context is required');
  }

  const normalizedMerchantId = merchantId.trim();
  const normalizedMerchantSlug = merchantSlug.trim();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const token = signAgenticJwt(
    {
      agentic_context: 'checkout',
      agentic_merchant_id: normalizedMerchantId,
      agentic_merchant_slug: normalizedMerchantSlug,
      aud: 'authenticated',
      exp: issuedAt + TOKEN_TTL_SECONDS,
      iat: issuedAt,
      role: 'authenticated',
      sub: normalizedMerchantId,
    },
    getAgenticJwtSigningMaterial()
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

function signAgenticJwt(
  payload: Record<string, unknown>,
  signer: AgenticJwtSigningMaterial
) {
  if (signer.type === 'legacy-secret') {
    return signLegacyJwt(payload, signer.secret);
  }

  return signPrivateJwkJwt(payload, signer);
}

function signPrivateJwkJwt(
  payload: Record<string, unknown>,
  signer: Extract<AgenticJwtSigningMaterial, { type: 'private-jwk' }>
) {
  const header = base64Url(
    JSON.stringify({ alg: 'ES256', kid: signer.jwk.kid, typ: 'JWT' })
  );
  const body = base64Url(JSON.stringify(payload));
  const signatureInput = `${header}.${body}`;
  const signature = signWithPrivateKey('sha256', Buffer.from(signatureInput), {
    dsaEncoding: 'ieee-p1363',
    key: signer.keyObject,
  }).toString('base64url');

  return `${signatureInput}.${signature}`;
}

function signLegacyJwt(payload: Record<string, unknown>, secret: string) {
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
