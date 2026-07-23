import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchMerchantPaystackSubaccountCode } from '@/lib/fetch-merchant-payment-secret';
import { logger } from '@/lib/logger';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

export interface OrderFundingMerchant {
  business_name: string | null;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string | null;
}

interface OrderFundingMerchantIdentity {
  business_name: string | null;
  id: string;
  slug: string | null;
}

export type OrderFundingRouteContext =
  | {
      customer: NonNullable<Awaited<ReturnType<typeof resolveVtuCustomer>>>;
      merchant: OrderFundingMerchant;
    }
  | { response: NextResponse };

// Identity only (no secret) — resolved on the caller's RLS client so an
// unpublished merchant is indistinguishable from a nonexistent one (no oracle).
const ORDER_FUNDING_MERCHANT_IDENTITY_SELECT = 'id, slug, business_name';

export async function resolveOrderFundingMerchantAndCustomer({
  identifiers,
  supabase,
  user,
}: {
  identifiers: { merchantId?: string; merchantSlug?: string };
  supabase: SupabaseClient;
  user: User;
}): Promise<OrderFundingRouteContext> {
  let identity: OrderFundingMerchantIdentity | null;
  try {
    // Resolve identity on the caller's RLS client first — no cross-tenant oracle.
    identity = await resolveWalletTopUpMerchant<OrderFundingMerchantIdentity>(
      supabase,
      identifiers,
      ORDER_FUNDING_MERCHANT_IDENTITY_SELECT
    );
  } catch (error) {
    logger.error({
      error,
      identifiers,
      message: 'Failed to resolve order-funding merchant context',
    });
    return {
      response: NextResponse.json(
        { error: 'Unable to resolve merchant' },
        { status: 500 }
      ),
    };
  }
  if (!identity) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  let customer: Awaited<ReturnType<typeof resolveVtuCustomer>>;
  try {
    customer = await resolveVtuCustomer({
      merchantId: identity.id,
      supabase,
      user,
    });
  } catch (error) {
    logger.error({
      error,
      merchantId: identity.id,
      message: 'Failed to resolve order-funding customer context',
    });
    return {
      response: NextResponse.json(
        { error: 'Unable to resolve customer' },
        { status: 500 }
      ),
    };
  }
  if (!customer) {
    return {
      response: NextResponse.json(
        { code: 'GUEST_CHECKOUT', error: 'Customer not found' },
        { status: 409 }
      ),
    };
  }

  // Customer is verified — only now read the revoked payment secret, via the
  // bounded SECURITY DEFINER RPC on the caller's authenticated client.
  const merchant: OrderFundingMerchant = {
    ...identity,
    paystack_subaccount_code: await fetchMerchantPaystackSubaccountCode(
      supabase,
      identity.id
    ),
  };

  return { customer, merchant };
}
