import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { getQuizRpcServerSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';

const QUIZ_VOUCHER_TOKEN_VERSION = 'qv1';

const quizVoucherTokenPayloadSchema = z
  .object({
    awardId: z.string().uuid(),
    condition: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    expiresAt: z.string().datetime({ offset: true }),
    productId: z.string().uuid(),
    userId: z.string().uuid(),
    variantId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

export type QuizVoucherTokenPayload = z.infer<
  typeof quizVoucherTokenPayloadSchema
>;

export type QuizVoucherTokenVerificationResult =
  | { ok: true; payload: QuizVoucherTokenPayload }
  | {
      error:
        | 'expired_quiz_voucher_token'
        | 'invalid_quiz_voucher_token'
        | 'missing_quiz_voucher_secret';
      ok: false;
    };

export class QuizVoucherTokenConfigError extends Error {
  constructor(message = 'missing_quiz_voucher_secret') {
    super(message);
    this.name = 'QuizVoucherTokenConfigError';
  }
}

function requireQuizVoucherSecret(secret = getQuizRpcServerSecret()): string {
  const normalized = secret?.trim();
  if (!normalized) {
    throw new QuizVoucherTokenConfigError();
  }

  return normalized;
}

function normalizeQuizVoucherPayload(
  payload: QuizVoucherTokenPayload
): QuizVoucherTokenPayload {
  const parsed = quizVoucherTokenPayloadSchema.parse(payload);

  return {
    awardId: parsed.awardId,
    condition: parsed.condition,
    expiresAt: parsed.expiresAt,
    productId: parsed.productId,
    userId: parsed.userId,
    variantId: parsed.variantId,
  };
}

function signVoucherTokenBody(body: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${QUIZ_VOUCHER_TOKEN_VERSION}.${body}`)
    .digest('base64url');
}

export function createQuizVoucherToken({
  payload,
  secret,
}: {
  payload: QuizVoucherTokenPayload;
  secret?: string;
}): string {
  const signingSecret = requireQuizVoucherSecret(secret);
  const normalizedPayload = normalizeQuizVoucherPayload(payload);
  const body = Buffer.from(JSON.stringify(normalizedPayload), 'utf8').toString(
    'base64url'
  );
  const signature = signVoucherTokenBody(body, signingSecret);

  return `${QUIZ_VOUCHER_TOKEN_VERSION}.${body}.${signature}`;
}

export function verifyQuizVoucherToken(
  token: string,
  {
    now = new Date().toISOString(),
    secret,
  }: { now?: string; secret?: string } = {}
): QuizVoucherTokenVerificationResult {
  let signingSecret: string;
  try {
    signingSecret = requireQuizVoucherSecret(secret);
  } catch {
    return { error: 'missing_quiz_voucher_secret', ok: false };
  }

  const [version, body, signature, ...extraParts] = token.split('.');
  if (
    version !== QUIZ_VOUCHER_TOKEN_VERSION ||
    !body ||
    !signature ||
    extraParts.length > 0
  ) {
    return { error: 'invalid_quiz_voucher_token', ok: false };
  }

  const expectedSignature = signVoucherTokenBody(body, signingSecret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return { error: 'invalid_quiz_voucher_token', ok: false };
  }

  let decodedPayload: unknown;
  try {
    decodedPayload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    );
  } catch {
    return { error: 'invalid_quiz_voucher_token', ok: false };
  }

  const parsedPayload = quizVoucherTokenPayloadSchema.safeParse(decodedPayload);
  if (!parsedPayload.success) {
    return { error: 'invalid_quiz_voucher_token', ok: false };
  }

  const expiresAtMs = Date.parse(parsedPayload.data.expiresAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) {
    return { error: 'invalid_quiz_voucher_token', ok: false };
  }

  if (nowMs > expiresAtMs) {
    return { error: 'expired_quiz_voucher_token', ok: false };
  }

  return {
    ok: true,
    payload: normalizeQuizVoucherPayload(parsedPayload.data),
  };
}
