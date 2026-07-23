import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

export type OrderFundingRouteContext<TMerchant> =
  | {
      customer: NonNullable<Awaited<ReturnType<typeof resolveVtuCustomer>>>;
      merchant: TMerchant;
    }
  | { response: NextResponse };

export const ORDER_FUNDING_MERCHANT_SELECT =
  'id, slug, business_name, paystack_subaccount_code';

const ALLOWED_ORDER_FUNDING_MERCHANT_SELECTS = new Set([
  ORDER_FUNDING_MERCHANT_SELECT,
]);

function assertOrderFundingMerchantSelect(merchantSelect: string) {
  if (!ALLOWED_ORDER_FUNDING_MERCHANT_SELECTS.has(merchantSelect)) {
    throw new Error('Unsupported order-funding merchant select');
  }
  return merchantSelect;
}

export async function resolveOrderFundingMerchantAndCustomer<
  TMerchant extends { id: string },
>({
  identifiers,
  merchantSelect,
  supabase,
  user,
}: {
  identifiers: { merchantId?: string; merchantSlug?: string };
  merchantSelect: string;
  supabase: SupabaseClient;
  user: User;
}): Promise<OrderFundingRouteContext<TMerchant>> {
  let merchant: TMerchant | null;
  try {
    // paystack_subaccount_code is SELECT-revoked from the authenticated role, so
    // the merchant payment-config lookup runs under the service-role client. The
    // customer lookup below stays on the caller's authenticated RLS client.
    const validatedMerchantSelect =
      assertOrderFundingMerchantSelect(merchantSelect);
    merchant = await resolveWalletTopUpMerchant<TMerchant>(
      createAdminClient(),
      identifiers,
      validatedMerchantSelect
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
  if (!merchant) {
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
      merchantId: merchant.id,
      supabase,
      user,
    });
  } catch (error) {
    logger.error({
      error,
      merchantId: merchant.id,
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

  return { customer, merchant };
}
