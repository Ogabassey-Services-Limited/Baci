import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { getQuizRpcServerSecret } from '@/lib/quiz/quiz-runtime-env';

const claimPayloadSchema = z.strictObject({
  awardId: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
  userId: z.uuid(),
});

const TOKEN_VERSION = 'qrc1';

function signature(body: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`${TOKEN_VERSION}.${body}`)
    .digest('base64url');
}

export function createQuizResultClaimToken(
  payload: z.input<typeof claimPayloadSchema>,
  options: { now?: string; secret?: string } = {}
): string | null {
  const parsed = claimPayloadSchema.parse(payload);
  const now = Date.parse(options.now ?? new Date().toISOString());
  if (Date.parse(parsed.expiresAt) <= now) return null;

  const secret = (options.secret ?? getQuizRpcServerSecret())?.trim();
  if (!secret) throw new Error('missing_quiz_result_claim_secret');

  const body = Buffer.from(JSON.stringify(parsed), 'utf8').toString(
    'base64url'
  );
  const tokenSignature = signature(body, secret);
  return `${TOKEN_VERSION}.${body}.${tokenSignature}`;
}
