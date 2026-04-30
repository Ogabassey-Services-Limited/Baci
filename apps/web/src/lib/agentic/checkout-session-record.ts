import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckoutItem } from '@/lib/agentic/checkout';
import type {
  AgenticMetadata,
  StoredCheckoutStatus,
} from '@/lib/agentic/checkout-storage';

export const MUTABLE_CHECKOUT_SESSION_STATUSES: StoredCheckoutStatus[] = [
  'pending',
  'processing',
];

export interface AgenticCheckoutSessionRecord {
  cart_items: CheckoutItem[];
  currency: string;
  id: string;
  merchant_id: string;
  metadata: AgenticMetadata | null;
  order_id: string | null;
  payment_reference: string | null;
  session_id: string;
  shipping_address: Record<string, unknown> | null;
  shipping_method: string | null;
  status: StoredCheckoutStatus;
  virtual_account_bank?: string | null;
  virtual_account_name?: string | null;
  virtual_account_number?: string | null;
}

const CHECKOUT_SESSION_SELECT =
  'id, session_id, merchant_id, cart_items, shipping_method, shipping_address, currency, status, order_id, payment_reference, virtual_account_bank, virtual_account_name, virtual_account_number, metadata';

export async function getAgenticCheckoutSession({
  merchantId,
  sessionId,
  supabase,
}: {
  merchantId: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select(CHECKOUT_SESSION_SELECT)
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  return {
    data: data as AgenticCheckoutSessionRecord | null,
    error,
  };
}
