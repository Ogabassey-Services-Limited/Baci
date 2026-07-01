import { constantTimeEqual } from '@/lib/constant-time-equal';

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.warn('[MyCover Webhook] Missing signature header');
    return false;
  }

  try {
    // MyCover's docs sign a re-serialized `JSON.stringify(body)` (Node) /
    // compact `json.dumps` (Python). To be robust to whichever canonical form
    // arrives on the wire, accept a match against either the verbatim received
    // body or its canonical re-serialization. Both require the secret, so this
    // is not a security weakening.
    const candidates = [rawBody];
    try {
      candidates.push(JSON.stringify(JSON.parse(rawBody)));
    } catch {
      // rawBody isn't JSON-parseable — only the verbatim candidate applies.
    }

    for (const message of candidates) {
      const expectedSignature = await hmacSha512Hex(secret, message);
      if (constantTimeEqual(signature, expectedSignature)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[MyCover Webhook] Signature verification error:', error);
    return false;
  }
}
