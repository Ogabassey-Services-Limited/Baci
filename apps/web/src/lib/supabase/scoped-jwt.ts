import { Buffer } from 'node:buffer';
import { createHmac, sign as signWithPrivateKey } from 'node:crypto';
import 'server-only';
import {
  type AgenticJwtSigningMaterial,
  getAgenticJwtSigningMaterial,
} from '@/lib/agentic/jwt-signing-material';

export function signScopedSupabaseJwt(
  payload: Record<string, unknown>,
  signer: AgenticJwtSigningMaterial = getAgenticJwtSigningMaterial()
) {
  if (signer.type === 'legacy-secret') {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', signer.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  if (signer.type !== 'private-jwk') {
    throw new Error(
      `Unsupported Supabase JWT signing material: ${
        (signer as { type?: string }).type ?? 'unknown'
      }`
    );
  }

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

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}
