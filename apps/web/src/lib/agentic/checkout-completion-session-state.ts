import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import {
  type CheckoutCompletionAuthorization,
  verifyCheckoutCompletionAuthorization,
} from '@/lib/agentic/checkout-authorization';
import {
  buildAuthorizationErrorBody,
  getAuthorizationErrorStatus,
  getCheckoutGrandTotal,
  withCompletionAuthorizationMetadata,
} from '@/lib/agentic/checkout-completion-authorization-response';
import {
  getAgenticPaymentState,
  getStoredCheckoutPaymentSnapshot,
  getStoredDvaAccount,
  type StoredDvaAccount,
} from '@/lib/agentic/checkout-completion-response';
import { buildPaymentAccountConflictResponse } from '@/lib/agentic/checkout-payment-account-conflict';
import type { CheckoutSessionCalculation } from '@/lib/agentic/checkout-payment-setup-types';
import { parseAgenticCheckoutSessionItems } from '@/lib/agentic/checkout-session-items';
import type { AgenticCheckoutSessionRecord } from '@/lib/agentic/checkout-session-record';
import {
  type AgenticMetadata,
  buildAgenticMetadata,
  mapCheckoutSessionStatus,
} from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';

interface CheckoutCompletionSessionStateInput {
  authorizationSecrets: string[];
  completionAuthorization: CheckoutCompletionAuthorization | null | undefined;
  merchantId: string;
  session: AgenticCheckoutSessionRecord;
  sessionId: string;
  supabase: SupabaseClient;
}

type CheckoutCompletionSessionState =
  | {
      canResumePaymentAccount: boolean;
      metadata: AgenticMetadata;
      ok: true;
      sessionCalc: CheckoutSessionCalculation;
      storedDvaAccount: StoredDvaAccount | null;
    }
  | { body: Record<string, unknown>; ok: false; status: number };

export async function resolveCheckoutCompletionSessionState({
  authorizationSecrets,
  completionAuthorization,
  merchantId,
  session,
  sessionId,
  supabase,
}: CheckoutCompletionSessionStateInput): Promise<CheckoutCompletionSessionState> {
  const paymentState = getAgenticPaymentState(session.metadata);

  if (paymentState === 'payment_account_ready') {
    if (session.metadata == null) {
      logger.warn({
        message: 'Payment-account-ready session is missing metadata',
        paymentState,
        sessionId,
      });
    }

    const storedDvaAccount = getStoredDvaAccount(session);
    const snapshot = getStoredCheckoutPaymentSnapshot(session.metadata);
    if (!storedDvaAccount || !snapshot || session.order_id) {
      return {
        body: buildPaymentAccountConflictResponse({
          orderId: session.order_id,
        }),
        ok: false,
        status: 409,
      };
    }

    return {
      canResumePaymentAccount: true,
      metadata: session.metadata ?? { agentic: {} },
      ok: true,
      sessionCalc: {
        fulfillmentOptions: [],
        lineItems: snapshot.lineItems,
        messages: [],
        selectedOptionId: session.shipping_method ?? undefined,
        totals: snapshot.totals,
      },
      storedDvaAccount,
    };
  }

  const parsedCartItems = parseAgenticCheckoutSessionItems(session.cart_items);
  if (!parsedCartItems.ok) {
    logger.error({
      message: 'Agentic checkout session has invalid cart items',
      error: parsedCartItems.error,
      sessionId,
    });
    return {
      body: { error: 'Invalid session cart items' },
      ok: false,
      status: 500,
    };
  }

  let sessionCalc: CheckoutSessionCalculation;
  try {
    sessionCalc = await calculateCheckoutSession(
      supabase,
      parsedCartItems.items,
      session.shipping_method,
      session.currency,
      merchantId
    );
  } catch (error) {
    logger.error({
      message: 'Agentic checkout calculation failed',
      error,
      sessionId,
    });
    return {
      body: { error: 'Checkout calculation failed' },
      ok: false,
      status: 500,
    };
  }

  const calculationErrors = sessionCalc.messages.filter(
    (message) => message.type === 'error'
  );
  if (calculationErrors.length > 0) {
    return {
      body: {
        error: 'Checkout calculation has errors',
        messages: calculationErrors,
      },
      ok: false,
      status: 409,
    };
  }

  let grandTotal: number;
  try {
    grandTotal = getCheckoutGrandTotal(sessionCalc.totals);
  } catch (error) {
    logger.error({
      message: 'Agentic checkout total calculation failed',
      error,
      sessionId,
      totals: sessionCalc.totals,
    });
    return {
      body: { error: 'Could not calculate total' },
      ok: false,
      status: 500,
    };
  }

  const status = mapCheckoutSessionStatus({
    status: session.status,
    hasFulfillmentAddress: !!session.shipping_address,
    hasLineItems: sessionCalc.lineItems.length > 0,
  });
  if (status !== 'ready_for_payment') {
    return {
      body: {
        error: 'Session is not ready for payment',
        status,
      },
      ok: false,
      status: 409,
    };
  }

  const authorization = verifyCheckoutCompletionAuthorization({
    amount: grandTotal,
    authorization: completionAuthorization,
    currency: session.currency,
    secrets: authorizationSecrets,
    sessionId: session.session_id,
  });
  if (!authorization.ok) {
    return {
      body: buildAuthorizationErrorBody(authorization.code),
      ok: false,
      status: getAuthorizationErrorStatus(authorization.code),
    };
  }

  return {
    canResumePaymentAccount: false,
    metadata: withCompletionAuthorizationMetadata(
      buildAgenticMetadata({
        existingMetadata: session.metadata,
        fulfillmentOptions: sessionCalc.fulfillmentOptions,
        lineItems: sessionCalc.lineItems,
        messages: [],
        totals: sessionCalc.totals,
      }),
      authorization.mode
    ),
    ok: true,
    sessionCalc,
    storedDvaAccount: null,
  };
}
