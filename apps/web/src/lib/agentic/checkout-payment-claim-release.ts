import {
  type ReleaseCheckoutPaymentClaimInput,
  releaseCheckoutPaymentClaim,
} from '@/lib/agentic/checkout-payment-claim';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

export async function releaseCheckoutPaymentClaimAfterFailure(
  input: ReleaseCheckoutPaymentClaimInput
): Promise<void> {
  try {
    const release = await releaseCheckoutPaymentClaim(input);
    if (release.error || !release.released) {
      logger.error({
        message: 'Checkout payment claim release did not complete',
        error: release.error,
        released: release.released,
        sessionId: sanitizeForLog(input.sessionId),
      });
    }
  } catch (error) {
    logger.error({
      message: 'Checkout payment claim release failed',
      error,
      sessionId: sanitizeForLog(input.sessionId),
    });
  }
}
