import { customAlphabet } from 'nanoid';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { initializeTransaction } from '@/lib/paystack';
import { createRepairBooking } from '@/lib/repairs/create-repair-core';
import {
  buildPickupItems,
  buildPickupSender,
} from '@/lib/repairs/pickup-shipment-utils';
import { quoteRepairPickup } from '@/lib/repairs/quote-repair-pickup';
import { getRepairCenterAddress } from '@/lib/repairs/repair-center-address';
import { repairPickupPaymentClaims } from '@/lib/repairs/repair-pickup-payment-claim';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { createClient } from '@/lib/supabase/server';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';
import {
  repairMerchantIdentifierSchema,
  repairMerchantIdSchema,
  repairPickupExpectedFeeSchema,
} from '@/schemas/repair-actions';

const createReference = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  16
);

const RESUMABLE_PICKUP_WINDOW_MS = 2 * 60 * 60 * 1000;

async function findResumablePickupRepair(
  supabase: Awaited<ReturnType<typeof createClient>>,
  merchantId: string,
  input: RepairBookingInput
): Promise<{ success: true; id: string; ticketNumber: number } | null> {
  const cutoff = new Date(
    Date.now() - RESUMABLE_PICKUP_WINDOW_MS
  ).toISOString();
  const { data, error } = await supabase
    .from('repairs')
    .select('id, ticket_number')
    .eq('merchant_id', merchantId)
    .eq('customer_email', input.customerEmail)
    .eq('service_type', 'pickup')
    .is('pickup_payment_reference', null)
    .is('shipment_id', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { id: string; ticket_number: number | string };
  const ticketNumber =
    typeof row.ticket_number === 'number'
      ? row.ticket_number
      : Number(row.ticket_number);
  if (!row.id || !Number.isFinite(ticketNumber)) {
    return null;
  }

  return { success: true, id: row.id, ticketNumber };
}

type StartRepairPickupPaymentResult =
  | {
      success: true;
      id: string;
      ticketNumber: number;
      payment: {
        amount: number;
        authorizationUrl: string;
        reference: string;
      };
    }
  | {
      success: false;
      code: string;
      error: string;
      id?: string;
      ticketNumber?: number;
      quote?: { formattedPrice: string; price: number };
    };

interface StartRepairPickupPaymentInput {
  data: unknown;
  expectedPickupFee: unknown;
  merchantId: string;
  merchantIdentifier: string;
}

export async function startRepairPickupPayment({
  data,
  expectedPickupFee,
  merchantId,
  merchantIdentifier,
}: StartRepairPickupPaymentInput): Promise<StartRepairPickupPaymentResult> {
  const allowed = await ensureActionRateLimit('repair-pickup-payment', {
    requests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return {
      success: false,
      code: 'rate_limited',
      error: 'Too many payment attempts. Please try again shortly.',
    };
  }

  const parsedMerchantId = repairMerchantIdSchema.safeParse(merchantId);
  const parsedMerchantIdentifier =
    repairMerchantIdentifierSchema.safeParse(merchantIdentifier);
  const parsedExpectedPickupFee =
    repairPickupExpectedFeeSchema.safeParse(expectedPickupFee);
  const parsed = repairBookingSchema.safeParse(data);
  if (
    !parsedMerchantId.success ||
    !parsedMerchantIdentifier.success ||
    !parsedExpectedPickupFee.success ||
    !parsed.success ||
    parsed.data.serviceType !== 'pickup'
  ) {
    return {
      success: false,
      code: 'validation_failed',
      error: 'Enter valid repair and pickup details.',
    };
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return {
      success: false,
      code: 'payment_initialization_failed',
      error: 'Pickup payment is unavailable right now. Please try again later.',
    };
  }

  const supabase = await createClient();
  const merchant = await resolveWalletTopUpMerchant<{
    id: string;
    slug: string | null;
    is_published: boolean | null;
  }>(
    supabase,
    {
      merchantId: parsedMerchantId.data,
      merchantSlug: parsedMerchantIdentifier.data,
    },
    'id, slug, is_published'
  );
  if (
    !merchant?.is_published ||
    merchant.id !== parsedMerchantId.data ||
    !merchant.slug
  ) {
    return {
      success: false,
      code: 'not_found',
      error: 'Store not found.',
    };
  }

  const receiver = await getRepairCenterAddress(merchant.id);
  const sender = buildPickupSender({
    customer_email: parsed.data.customerEmail,
    customer_name: parsed.data.customerName,
    customer_phone: parsed.data.customerPhone,
    device_model: parsed.data.deviceModel,
    device_type: parsed.data.deviceType,
    pickup_address: parsed.data.pickupAddress ?? null,
    quoted_price: null,
  });
  if (!receiver || !sender) {
    return {
      success: false,
      code: 'pickup_unavailable',
      error: 'Courier pickup is not available for this address.',
    };
  }

  const items = buildPickupItems({
    customer_email: parsed.data.customerEmail,
    customer_name: parsed.data.customerName,
    customer_phone: parsed.data.customerPhone,
    device_model: parsed.data.deviceModel,
    device_type: parsed.data.deviceType,
    pickup_address: parsed.data.pickupAddress ?? null,
    quoted_price: null,
  });
  let quoteResult: Awaited<ReturnType<typeof quoteRepairPickup>>;
  try {
    quoteResult = await quoteRepairPickup({
      items,
      merchantId: merchant.id,
      receiver,
      sender,
    });
  } catch (error) {
    console.error('Repair pickup quote failed during payment start:', error);
    return {
      success: false,
      code: 'pickup_unavailable',
      error: 'Courier pickup is not available for this address.',
    };
  }
  const { quote } = quoteResult;
  if (!quote) {
    return {
      success: false,
      code: 'pickup_unavailable',
      error: 'Courier pickup is not available for this address.',
    };
  }

  const expectedKobo = Math.round(parsedExpectedPickupFee.data * 100);
  const amountKobo = Math.round(quote.price * 100);
  if (expectedKobo !== amountKobo) {
    return {
      success: false,
      code: 'quote_changed',
      error: 'The pickup price changed. Review the new price before paying.',
      quote: {
        formattedPrice: `₦${quote.price.toLocaleString()}`,
        price: quote.price,
      },
    };
  }

  const repair =
    (await findResumablePickupRepair(supabase, merchant.id, parsed.data)) ??
    (await createRepairBooking(parsed.data, merchant.id));
  if (!repair.success) return repair;

  const reference = `RPU-${createReference()}`;
  const metadata = repairPickupPaymentClaims.create(
    {
      amountKobo,
      currency: quote.currency,
      merchantId: merchant.id,
      reference,
      repairId: repair.id,
    },
    secret
  );
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const callbackUrl = `${protocol}://${merchant.slug}.${rootDomain}/repair/status?ticket=${repair.ticketNumber}`;

  try {
    const payment = await initializeTransaction({
      amount: amountKobo,
      callback_url: callbackUrl,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      email: parsed.data.customerEmail,
      metadata,
      reference,
    });
    return {
      success: true,
      id: repair.id,
      ticketNumber: repair.ticketNumber,
      payment: {
        amount: quote.price,
        authorizationUrl: payment.authorization_url,
        reference,
      },
    };
  } catch (error) {
    console.error('Repair pickup payment initialization failed:', error);
    return {
      success: false,
      code: 'payment_initialization_failed',
      error:
        'Your repair request was saved, but payment could not start. Use your ticket to retry shortly.',
      id: repair.id,
      ticketNumber: repair.ticketNumber,
    };
  }
}
