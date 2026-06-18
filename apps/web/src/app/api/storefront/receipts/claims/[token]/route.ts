import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  buildReceiptDeviceList,
  hashReceiptClaimToken,
  normalizeClaimEmail,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { createAdminClient } from '@/lib/supabase/admin';

const claimParamsSchema = z.object({
  token: z
    .string()
    .min(8)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/),
});

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface ClaimMerchant {
  business_name: string | null;
  custom_domain: string | null;
  slug: string;
}

interface ClaimOrderItem {
  name: string | null;
  quantity: number | null;
}

interface ClaimOrder {
  id: string;
  order_items?: ClaimOrderItem[] | null;
  order_number: string;
}

interface ClaimOrderJoin {
  orders?: ClaimOrder | ClaimOrder[] | null;
}

interface ReceiptClaimRecord {
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  customer_email: string;
  customer_id: string;
  customer_name: string | null;
  expires_at: string;
  id: string;
  merchant_id: string;
  merchants?: ClaimMerchant | ClaimMerchant[] | null;
  receipt_claim_orders?: ClaimOrderJoin[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isExpired(expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

function extractClaimOrders(claim: ReceiptClaimRecord) {
  return (claim.receipt_claim_orders ?? [])
    .map((claimOrder) => firstRelation(claimOrder.orders))
    .filter((order): order is ClaimOrder => Boolean(order));
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  const parsed = claimParamsSchema.safeParse(params);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.token;
}

async function loadReceiptClaim(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('receipt_claims')
    .select(
      'id, merchant_id, customer_id, customer_email, customer_name, expires_at, claimed_at, claimed_by_user_id, merchants(business_name, slug, custom_domain), receipt_claim_orders(orders(id, order_number, order_items(name, quantity)))'
    )
    .eq('token_hash', hashReceiptClaimToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load receipt claim: ${error.message}`);
  }

  return {
    claim: data as ReceiptClaimRecord | null,
    supabase,
  };
}

function buildClaimPreview(claim: ReceiptClaimRecord) {
  const merchant = firstRelation(claim.merchants);
  const orders = extractClaimOrders(claim);

  return {
    claim: {
      claimed: Boolean(claim.claimed_at),
      customerName: claim.customer_name,
      devices: buildReceiptDeviceList(
        orders as ReceiptClaimOrderForDeviceList[]
      ),
      merchantName: merchant?.business_name ?? 'Ogabassey',
    },
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  try {
    const { claim } = await loadReceiptClaim(token);

    if (!claim) {
      return NextResponse.json(
        { error: 'Receipt claim link not found' },
        { status: 404 }
      );
    }

    if (isExpired(claim.expires_at)) {
      return NextResponse.json(
        { error: 'Receipt claim link has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json(buildClaimPreview(claim));
  } catch (error) {
    console.error('Failed to load receipt claim', error);
    return NextResponse.json(
      { error: 'Failed to load receipt claim' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  try {
    const { claim, supabase } = await loadReceiptClaim(token);

    if (!claim) {
      return NextResponse.json(
        { error: 'Receipt claim link not found' },
        { status: 404 }
      );
    }

    if (isExpired(claim.expires_at)) {
      return NextResponse.json(
        { error: 'Receipt claim link has expired' },
        { status: 410 }
      );
    }

    if (
      normalizeClaimEmail(auth.user.email) !==
      normalizeClaimEmail(claim.customer_email)
    ) {
      return NextResponse.json(
        {
          error:
            'Sign in with the email address that received this receipt link',
        },
        { status: 403 }
      );
    }

    if (claim.claimed_by_user_id && claim.claimed_by_user_id !== auth.user.id) {
      return NextResponse.json(
        { error: 'Receipt claim link has already been used' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { data: linkedCustomer, error: customerError } = await supabase
      .from('customers')
      .update({
        last_login_at: now,
        user_id: auth.user.id,
      })
      .eq('id', claim.customer_id)
      .eq('merchant_id', claim.merchant_id)
      .or(`user_id.is.null,user_id.eq.${auth.user.id}`)
      .select('id')
      .maybeSingle();

    if (customerError) {
      throw new Error(
        `Failed to link customer receipt account: ${customerError.message}`
      );
    }

    if (!linkedCustomer) {
      throw new Error('Failed to link customer receipt account');
    }

    const { error: claimUpdateError } = await supabase
      .from('receipt_claims')
      .update({
        claimed_at: claim.claimed_at || now,
        claimed_by_user_id: auth.user.id,
        last_viewed_at: now,
        updated_at: now,
      })
      .eq('id', claim.id);

    if (claimUpdateError) {
      throw new Error(
        `Failed to mark receipt claim as redeemed: ${claimUpdateError.message}`
      );
    }

    return NextResponse.json({
      redirectPath: '/receipts',
      success: true,
    });
  } catch (error) {
    console.error('Failed to redeem receipt claim', error);
    return NextResponse.json(
      { error: 'Failed to redeem receipt claim' },
      { status: 500 }
    );
  }
}
