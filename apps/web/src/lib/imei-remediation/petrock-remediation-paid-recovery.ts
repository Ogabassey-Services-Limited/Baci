import 'server-only';

import { getImeiFxNgnUsd } from '@/env';
import { decryptImeiIdentifier } from '@/lib/imei-identifier-crypto';
import type { createPetrockClient } from '@/lib/imei-providers/petrock/petrock-client';
import type { createAdminClient } from '@/lib/supabase/admin';
import { placePetrockRemediationOrder } from './petrock-remediation-order-flow';
import {
  createPetrockRemediationOrderState,
  loadPetrockRemediationOrderContext,
} from './petrock-remediation-order-state';
import type { ClaimedPetrockRemediationOrder } from './petrock-remediation-reconcile-state';

export async function recoverPaidPetrockRemediationOrder({
  client,
  encryptionKey,
  order,
  origin,
  supabaseAdmin,
}: {
  client: ReturnType<typeof createPetrockClient>;
  encryptionKey: string;
  order: ClaimedPetrockRemediationOrder;
  origin: string;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}) {
  const fxRate = getImeiFxNgnUsd();
  const state = createPetrockRemediationOrderState({
    customerId: order.customer_id,
    fxRate: fxRate ?? 0,
    merchantId: order.merchant_id,
    supabaseAdmin,
  });
  if (typeof fxRate !== 'number' || !Number.isFinite(fxRate) || fxRate <= 0) {
    await state.failBeforeAcceptance({
      customerMessage:
        'This unlock could not be submitted, so your wallet was refunded.',
      orderId: order.id,
      reason: 'paid_recovery_fx_unavailable',
    });
    return { kind: 'failed' as const };
  }
  if (
    !order.identifier_ciphertext ||
    !order.payment_currency ||
    !order.remediation_product_id
  ) {
    await state.failBeforeAcceptance({
      customerMessage:
        'This unlock could not be submitted, so your wallet was refunded.',
      orderId: order.id,
      reason: 'paid_recovery_context_missing',
    });
    return { kind: 'failed' as const };
  }

  const context = await loadPetrockRemediationOrderContext({
    customerId: order.customer_id,
    merchantId: order.merchant_id,
    orderId: order.id,
    productId: order.remediation_product_id,
    supabaseAdmin,
  });
  if (!context) {
    await state.failBeforeAcceptance({
      customerMessage:
        'This unlock could not be submitted, so your wallet was refunded.',
      orderId: order.id,
      reason: 'paid_recovery_context_missing',
    });
    return { kind: 'failed' as const };
  }

  let identifier: string;
  try {
    identifier = decryptImeiIdentifier(
      context.identifierCiphertext,
      encryptionKey
    );
  } catch {
    await state.failBeforeAcceptance({
      customerMessage:
        'This unlock could not be submitted, so your wallet was refunded.',
      orderId: order.id,
      reason: 'paid_recovery_identifier_unavailable',
    });
    return { kind: 'failed' as const };
  }

  return placePetrockRemediationOrder({
    client,
    fxRate,
    identifier,
    order: { ...context.order, status: 'paid' },
    origin,
    paymentCurrency: order.payment_currency,
    product: context.product,
    state,
  });
}
