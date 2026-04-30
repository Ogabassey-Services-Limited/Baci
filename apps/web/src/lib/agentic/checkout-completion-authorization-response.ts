import type { GPTTotal } from '@/lib/agentic/checkout';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';

export type CheckoutAuthorizationErrorCode =
  | 'AUTHORIZATION_EXPIRED'
  | 'AUTHORIZATION_INVALID'
  | 'CONFIRMATION_MISMATCH'
  | 'CONFIRMATION_REQUIRED'
  | 'SERVER_CONFIGURATION_ERROR';

export type CheckoutAuthorizationErrorBody = {
  code: CheckoutAuthorizationErrorCode;
  error: string;
  retryable: boolean;
};

export function getCheckoutGrandTotal(totals: GPTTotal[]): number {
  const amount = totals.find((t) => t.type === 'total')?.amount;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new Error('Missing or invalid total amount');
    }
    return amount;
  }

  if (typeof amount === 'string') {
    const parsed = Number.parseFloat(amount);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error('Missing or invalid total amount');
}

export function getCheckoutCompletionAuthorizationSecrets(): string[] {
  return [
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY,
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS,
  ].filter((value): value is string => Boolean(value));
}

export function buildAuthorizationErrorBody(
  code: CheckoutAuthorizationErrorCode
): CheckoutAuthorizationErrorBody {
  if (code === 'CONFIRMATION_REQUIRED') {
    return {
      code,
      error: 'Human confirmation required',
      retryable: true,
    };
  }

  if (code === 'SERVER_CONFIGURATION_ERROR') {
    logger.error({
      code,
      message: 'Agentic checkout authorization key is not configured',
    });
    return {
      code,
      error: 'Checkout authorization is temporarily unavailable',
      retryable: false,
    };
  }

  return {
    code,
    error: 'Checkout authorization invalid',
    retryable: false,
  };
}

export function getAuthorizationErrorStatus(
  code: CheckoutAuthorizationErrorCode
): number {
  if (code === 'CONFIRMATION_REQUIRED') {
    return 428;
  }

  if (code === 'SERVER_CONFIGURATION_ERROR') {
    return 503;
  }

  return 403;
}

export function withCompletionAuthorizationMetadata(
  metadata: AgenticMetadata,
  authorizationMode: string
): AgenticMetadata {
  const existingCompletion = metadata.agentic?.completion;
  const completion =
    existingCompletion &&
    typeof existingCompletion === 'object' &&
    !Array.isArray(existingCompletion)
      ? existingCompletion
      : {};

  return {
    ...metadata,
    agentic: {
      ...(metadata.agentic ?? {}),
      completion: {
        ...completion,
        authorization_mode: authorizationMode,
      },
    },
  };
}
