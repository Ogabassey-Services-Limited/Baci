import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReceiptDeviceList,
  hashReceiptClaimToken,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { receiptClaimRouteParamsSchema } from '@/schemas/receipt-claim-route-params';

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

export interface ReceiptClaimPreview {
  claimed: boolean;
  customerName: string | null;
  devices: string[];
  merchantName: string;
}

export type ReceiptClaimPreviewResult =
  | { ok: true; claim: ReceiptClaimPreview }
  | { ok: false; error: string; status: 400 | 404 | 410 };

export function parseReceiptClaimToken(token: string | undefined) {
  const parsed = receiptClaimRouteParamsSchema.safeParse({ token });
  return parsed.success ? parsed.data.token : null;
}

function isExpired(expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

function buildClaimPreview(claim: ReceiptClaimRecord): ReceiptClaimPreview {
  const orders = claim.orders ?? [];

  return {
    claimed: Boolean(claim.claimed_at),
    customerName: claim.customer_name,
    devices: buildReceiptDeviceList(orders as ReceiptClaimOrderForDeviceList[]),
    merchantName:
      claim.merchant?.business_name ?? claim.merchant?.slug ?? 'Store',
  };
}

export async function loadReceiptClaimPreview({
  supabase,
  token,
}: {
  supabase: SupabaseClient;
  token: string;
}): Promise<ReceiptClaimPreviewResult> {
  const { data, error } = await supabase.rpc('preview_receipt_claim', {
    p_token_hash: hashReceiptClaimToken(token),
  });

  if (error) {
    throw new Error(`Failed to load receipt claim: ${error.message}`);
  }

  const claim = (data || null) as ReceiptClaimRecord | null;

  if (!claim) {
    return { error: 'Receipt claim link not found', ok: false, status: 404 };
  }

  if (isExpired(claim.expires_at)) {
    return { error: 'Receipt claim link has expired', ok: false, status: 410 };
  }

  return { claim: buildClaimPreview(claim), ok: true };
}
