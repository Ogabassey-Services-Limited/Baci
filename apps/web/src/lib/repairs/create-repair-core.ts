import { cookies } from 'next/headers';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';
import { repairMerchantIdSchema } from '@/schemas/repair-actions';

export type CreateRepairResult =
  | { success: true; id: string; ticketNumber: number }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

const RATE_LIMIT_MESSAGE =
  'Too many repair requests. Please try again in a minute.';
const GENERIC_FAILURE = 'Failed to submit repair request. Please try again.';

/**
 * Maps the booking RPC's raised exception messages to storefront-safe copy.
 * The DB raises `rate_limited`, `merchant_not_found`, `quote_unavailable`, etc.
 */
function mapRpcError(message: string | undefined): string {
  if (!message) {
    return GENERIC_FAILURE;
  }
  if (message.includes('rate_limited')) {
    return RATE_LIMIT_MESSAGE;
  }
  if (
    message.includes('merchant_not_found') ||
    message.includes('merchant_required')
  ) {
    return 'Store not found.';
  }
  if (
    message.includes('quote_unavailable') ||
    message.includes('device_unavailable') ||
    message.includes('catalog_disabled')
  ) {
    return 'That repair option is no longer available. Please pick another.';
  }
  return GENERIC_FAILURE;
}

/**
 * Shared repair booking core used by the web server action and (later) the
 * mobile storefront route. Applies the app-layer rate limit FIRST, validates
 * input, then delegates the write to the SECURITY DEFINER booking RPC which
 * re-validates the merchant/active quote and snapshots the price server-side.
 */
export async function createRepairBooking(
  data: RepairBookingInput,
  merchantId: string
): Promise<CreateRepairResult> {
  const allowed = await ensureActionRateLimit('repair-create', {
    requests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const parsedMerchantId = repairMerchantIdSchema.safeParse(merchantId);
  if (!parsedMerchantId.success) {
    return { success: false, error: 'Invalid store reference.' };
  }

  const parsed = repairBookingSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: rpcData, error } = await supabase.rpc('create_repair_booking', {
    p_merchant_id: parsedMerchantId.data,
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail,
    p_customer_phone: input.customerPhone,
    p_device_type: input.deviceType,
    p_device_model: input.deviceModel,
    p_issue_description: input.issueDescription,
    p_preferred_date: input.preferredDate
      ? new Date(input.preferredDate).toISOString()
      : null,
    p_service_type: input.serviceType,
    p_pickup_address: input.pickupAddress || null,
    p_device_id: input.deviceId ?? null,
    p_quote_id: input.quoteId ?? null,
  });

  if (error) {
    console.error('Error creating repair booking:', error);
    return { success: false, error: mapRpcError(error.message) };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const record =
    row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
  const id = record?.id;
  const ticketNumber = record?.ticket_number;

  if (typeof id !== 'string' || typeof ticketNumber !== 'number') {
    return { success: false, error: GENERIC_FAILURE };
  }

  return { success: true, id, ticketNumber };
}
