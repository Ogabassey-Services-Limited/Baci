import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { z } from 'zod';

const ED25519_JWK_SCHEMA = z
  .object({
    crv: z.literal('Ed25519'),
    kty: z.literal('OKP'),
    x: z.string().min(1),
  })
  .passthrough();

const WEB_BOT_AUTH_JWKS_SCHEMA = z.object({
  keys: z.array(ED25519_JWK_SCHEMA).min(1),
});

export const WEB_BOT_AUTH_CONTENT_TYPE =
  'application/http-message-signatures-directory+json';

function base64UrlSha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function getJwkThumbprint(jwk: z.infer<typeof ED25519_JWK_SCHEMA>): string {
  return base64UrlSha256(
    JSON.stringify({
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
    })
  );
}

function buildSignatureParams({
  created,
  expires,
  keyid,
  nonce,
}: {
  created: number;
  expires: number;
  keyid: string;
  nonce: string;
}): string {
  return `("@authority";req);alg="ed25519";keyid="${keyid}";nonce="${nonce}";tag="http-message-signatures-directory";created=${created};expires=${expires}`;
}

function buildSignatureBase(authority: string, signatureParams: string) {
  return `"@authority";req: ${authority}\n"@signature-params": ${signatureParams}`;
}

export function buildWebBotAuthDirectoryResponse({
  authority,
  now = new Date(),
  privateKeyPem,
  publicJwksJson,
}: {
  authority: string;
  now?: Date;
  privateKeyPem?: string;
  publicJwksJson?: string;
}): Response | null {
  if (!publicJwksJson || !privateKeyPem) return null;

  let publicJwks: unknown;
  try {
    publicJwks = JSON.parse(publicJwksJson);
  } catch {
    return null;
  }

  const parsed = WEB_BOT_AUTH_JWKS_SCHEMA.safeParse(publicJwks);
  if (!parsed.success) return null;

  // The first JWKS entry is the active Web Bot Auth public key for this site.
  const keyid = getJwkThumbprint(parsed.data.keys[0]);
  const created = Math.floor(now.getTime() / 1000);
  const expires = created + 60;
  const nonce = randomBytes(32).toString('base64');
  const signatureParams = buildSignatureParams({
    created,
    expires,
    keyid,
    nonce,
  });
  const signatureBase = buildSignatureBase(authority, signatureParams);
  let signature: string;
  try {
    const privateKey = createPrivateKey(normalizePem(privateKeyPem));
    signature = sign(null, Buffer.from(signatureBase), privateKey).toString(
      'base64'
    );
  } catch {
    return null;
  }

  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    headers: {
      'Content-Type': `${WEB_BOT_AUTH_CONTENT_TYPE}; charset=utf-8`,
      'Cache-Control': 'public, max-age=60',
      Signature: `sig1=:${signature}:`,
      'Signature-Input': `sig1=${signatureParams}`,
    },
  });
}
