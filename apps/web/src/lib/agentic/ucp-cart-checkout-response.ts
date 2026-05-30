import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CheckoutItem,
  calculateCheckoutSession,
} from '@/lib/agentic/checkout';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';
import {
  mapCheckoutSessionStatus,
  type StoredCheckoutStatus,
} from '@/lib/agentic/checkout-storage';
import type { AgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { coerceUcpCartItems } from '@/lib/agentic/ucp-cart-storage';
import { buildStoreUrl } from '@/lib/store-url';

export interface UcpCheckoutSessionRow {
  cart_items: CheckoutItem[];
  currency: string;
  id: string;
  metadata: Record<string, unknown> | null;
  session_id: string;
  shipping_address: Record<string, unknown> | null;
  shipping_method: string | null;
  status: StoredCheckoutStatus;
}

export async function loadCheckoutSessionByRowId({
  merchantId,
  rowId,
  supabase,
}: {
  merchantId: string;
  rowId: string;
  supabase: SupabaseClient;
}): Promise<{ error: unknown; session: UcpCheckoutSessionRow | null }> {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select(
      'id, session_id, cart_items, currency, metadata, shipping_address, shipping_method, status'
    )
    .eq('id', rowId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  return { error, session: data as UcpCheckoutSessionRow | null };
}

export async function buildCheckoutResponseFromSession({
  merchant,
  requestUrl,
  session,
  supabase,
}: {
  merchant: AgenticMerchantContext;
  requestUrl: string;
  session: UcpCheckoutSessionRow;
  supabase: SupabaseClient;
}) {
  const sessionCalc = await calculateCheckoutSession(
    supabase,
    coerceUcpCartItems(session.cart_items),
    session.shipping_method,
    session.currency,
    merchant.id
  );
  const status = mapCheckoutSessionStatus({
    hasFulfillmentAddress: !!session.shipping_address,
    hasLineItems: sessionCalc.lineItems.length > 0,
    status: session.status,
  });

  return buildCheckoutSessionStateResponse({
    currency: session.currency,
    fulfillmentOptionId: session.shipping_method,
    fulfillmentOptions: sessionCalc.fulfillmentOptions,
    lineItems: sessionCalc.lineItems,
    messages: sessionCalc.messages,
    policyBaseUrl: resolvePolicyBaseUrl({ merchant, requestUrl }),
    sessionId: session.session_id,
    shippingAddress: session.shipping_address,
    status,
    totals: sessionCalc.totals,
  });
}

export function resolvePolicyBaseUrl({
  merchant,
  requestUrl,
}: {
  merchant: AgenticMerchantContext;
  requestUrl: string;
}) {
  const url = new URL(requestUrl);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return `${url.origin}/${merchant.slug}`;
  }

  return buildStoreUrl(merchant);
}
