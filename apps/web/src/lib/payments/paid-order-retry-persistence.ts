import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const PAID_ORDER_RETRY_STEPS = [
  'paid_email',
  'ad_tracking_conversion',
  'merchant_settlement',
] as const;
export const WEBHOOK_SIDE_EFFECT_FAILURE_REASON =
  'webhook_side_effect_runner_failed';

const nonEmptyStringSchema = z.string().trim().min(1);
const paidOrderSideEffectRetrySchema = z.object({
  error: z.unknown(),
  orderId: nonEmptyStringSchema,
  reference: nonEmptyStringSchema,
  transaction: z
    .object({
      id: nonEmptyStringSchema,
    })
    .passthrough(),
});

export function parseRetryInput(input: {
  error: unknown;
  orderId: string;
  reference: string;
  transaction: { id: string };
}) {
  const parsed = paidOrderSideEffectRetrySchema.safeParse(input);
  if (parsed.success) return parsed.data;

  const fields = parsed.error.issues
    .map((issue) => issue.path.join('.') || 'input')
    .join(', ');
  throw new Error(
    `persistPaidOrderSideEffectRetry validation failed: ${fields}`
  );
}

export async function persistPaidOrderSideEffectRetry({
  error,
  orderId,
  reference,
  supabase,
  transaction,
}: {
  error: unknown;
  orderId: string;
  reference: string;
  supabase: SupabaseClient;
  transaction: { id: string };
}) {
  const parsed = parseRetryInput({ error, orderId, reference, transaction });
  const message =
    parsed.error instanceof Error ? parsed.error.message : String(parsed.error);
  const { error: retryError } = await supabase
    .from('payment_side_effects')
    .upsert(
      PAID_ORDER_RETRY_STEPS.map((step) => ({
        claimed_by: `webhook:${parsed.reference}`,
        error: message,
        order_id: parsed.orderId,
        result: {
          gateway_reference: parsed.reference,
          reason: WEBHOOK_SIDE_EFFECT_FAILURE_REASON,
        },
        status: 'failed',
        step,
        transaction_id: parsed.transaction.id,
      })),
      { onConflict: 'order_id,step' }
    );
  if (retryError) {
    throw new Error(
      `Failed to persist paid order side-effect retry: ${retryError.message ?? 'unknown error'}`
    );
  }
}
