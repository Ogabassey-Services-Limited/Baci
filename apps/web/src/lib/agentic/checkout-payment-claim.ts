import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckoutItem } from '@/lib/agentic/checkout';
import type {
  AgenticCheckoutBuyer,
  StoredDvaAccount,
} from '@/lib/agentic/checkout-completion-response';
import type {
  AgenticMetadata,
  StoredCheckoutStatus,
} from '@/lib/agentic/checkout-storage';

export interface ReleaseCheckoutPaymentClaimInput {
  buyer: AgenticCheckoutBuyer;
  claimReference: string;
  failureDetails?: Record<string, unknown>;
  merchantId: string;
  metadata: AgenticMetadata;
  sessionId: string;
  supabase: SupabaseClient;
}

interface CheckoutPaymentAccountReadyInput
  extends ReleaseCheckoutPaymentClaimInput {
  dvaAccount: StoredDvaAccount;
}

export interface ClaimedCheckoutSession {
  cart_items: CheckoutItem[];
  currency: string;
  id: string;
  merchant_id: string;
  metadata: AgenticMetadata | null;
  session_id: string;
  shipping_address: Record<string, unknown> | null;
  shipping_method: string | null;
  status: StoredCheckoutStatus;
}

export function buildCheckoutPaymentClaimReference(sessionId: string): string {
  return `agentic_claim_${sessionId}_${randomUUID()}`;
}

export async function claimCheckoutPaymentSetup({
  buyer,
  claimReference,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: ReleaseCheckoutPaymentClaimInput) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildClaimMetadata({
        buyer,
        metadata,
        paymentState: 'claiming_payment',
      }),
      payment_reference: claimReference,
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .is('order_id', null)
    .is('payment_reference', null)
    .is('virtual_account_number', null)
    .eq('status', 'processing')
    .not('shipping_address', 'is', null)
    .select(
      'id, session_id, merchant_id, cart_items, shipping_method, shipping_address, currency, status, metadata'
    )
    .maybeSingle();

  return {
    claimed: !error && !!data,
    error,
    session: data as ClaimedCheckoutSession | null,
  };
}

export async function markCheckoutPaymentAccountReady({
  buyer,
  claimReference,
  dvaAccount,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: CheckoutPaymentAccountReadyInput) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildClaimMetadata({
        buyer,
        failureDetails: {
          dva_account: dvaAccount,
        },
        metadata,
        paymentState: 'payment_account_ready',
      }),
      payment_method: 'bank_transfer',
      payment_provider: 'paystack',
      payment_reference: dvaAccount.account_number,
      virtual_account_bank: dvaAccount.bank_name ?? null,
      virtual_account_name: dvaAccount.account_name ?? null,
      virtual_account_number: dvaAccount.account_number,
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', claimReference)
    .select('session_id')
    .maybeSingle();

  return {
    error,
    stored: !error && !!data,
  };
}

export async function releaseCheckoutPaymentClaim({
  buyer,
  claimReference,
  failureDetails,
  merchantId,
  metadata,
  sessionId,
  supabase,
}: ReleaseCheckoutPaymentClaimInput) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildClaimMetadata({
        buyer,
        failureDetails,
        metadata,
        paymentState: 'payment_setup_failed',
      }),
      payment_reference: null,
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', claimReference)
    .select('session_id')
    .maybeSingle();

  return { error, released: !error && !!data };
}

function buildClaimMetadata({
  buyer,
  failureDetails,
  metadata,
  paymentState,
}: {
  buyer: AgenticCheckoutBuyer;
  failureDetails?: Record<string, unknown>;
  metadata: AgenticMetadata;
  paymentState:
    | 'claiming_payment'
    | 'payment_account_ready'
    | 'payment_setup_failed';
}) {
  return {
    ...metadata,
    agentic: {
      ...(metadata.agentic ?? {}),
      ...(failureDetails ?? {}),
      buyer,
      payment_state: paymentState,
    },
  };
}
