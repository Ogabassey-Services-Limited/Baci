import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  buildReceiptDeviceList,
  hashReceiptClaimToken,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { createClient } from '@/lib/supabase/server';
import { receiptClaimRouteParamsSchema } from '@/schemas/receipt-claim-route-params';

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface ClaimMerchant {
  business_name: string | null;
  slug: string | null;
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

interface ReceiptClaimRecord {
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  customer_email: string;
  customer_id: string;
  customer_name: string | null;
  expires_at: string;
  id: string;
  merchant_id: string;
  merchant?: ClaimMerchant | null;
  orders?: ClaimOrder[] | null;
}

interface RedeemReceiptClaimResult {
  redirectPath?: string;
  status?:
    | 'already_used'
    | 'customer_link_failed'
    | 'email_mismatch'
    | 'expired'
    | 'not_found'
    | 'ok'
    | 'unauthorized';
}

function isExpired(expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  const parsed = receiptClaimRouteParamsSchema.safeParse(params);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.token;
}

async function loadReceiptClaim(supabase: SupabaseClient, token: string) {
  const { data, error } = await supabase.rpc('preview_receipt_claim', {
    p_token_hash: hashReceiptClaimToken(token),
  });

  if (error) {
    throw new Error(`Failed to load receipt claim: ${error.message}`);
  }

  return (data || null) as ReceiptClaimRecord | null;
}

function buildClaimPreview(claim: ReceiptClaimRecord) {
  const orders = claim.orders ?? [];

  return {
    claim: {
      claimed: Boolean(claim.claimed_at),
      customerName: claim.customer_name,
      devices: buildReceiptDeviceList(
        orders as ReceiptClaimOrderForDeviceList[]
      ),
      merchantName:
        claim.merchant?.business_name ?? claim.merchant?.slug ?? 'Store',
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
    const supabase = await createClient();
    const claim = await loadReceiptClaim(supabase, token);

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
  if (auth.error || !auth.user || !auth.supabase) {
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
    const { data, error } = await auth.supabase.rpc('redeem_receipt_claim', {
      p_token_hash: hashReceiptClaimToken(token),
    });

    if (error) {
      throw new Error(`Failed to redeem receipt claim: ${error.message}`);
    }

    const result = (data || null) as RedeemReceiptClaimResult | null;

    if (!result || result.status === 'not_found') {
      return NextResponse.json(
        { error: 'Receipt claim link not found' },
        { status: 404 }
      );
    }

    if (result.status === 'expired') {
      return NextResponse.json(
        { error: 'Receipt claim link has expired' },
        { status: 410 }
      );
    }

    if (result.status === 'email_mismatch') {
      return NextResponse.json(
        {
          error:
            'Sign in with the email address that received this receipt link',
        },
        { status: 403 }
      );
    }

    if (result.status === 'already_used') {
      return NextResponse.json(
        { error: 'Receipt claim link has already been used' },
        { status: 409 }
      );
    }

    if (result.status === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (result.status !== 'ok') {
      throw new Error(
        `Failed to redeem receipt claim: ${result.status || 'unknown_status'}`
      );
    }

    return NextResponse.json({
      redirectPath: result.redirectPath || '/receipts',
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
