import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeCustomerLoginEmailPrefill } from '@/lib/customer-login-prefill';
import {
  buildReceiptDeviceList,
  hashReceiptClaimToken,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { receiptClaimRouteParamsSchema } from '@/schemas/receipt-claim-route-params';
import {
  type ReceiptClaimRecord,
  receiptClaimRecordSchema,
} from '@/schemas/receipt-claim-rpc';

export interface ReceiptClaimPreview {
  claimed: boolean;
  customerName: string | null;
  devices: string[];
  merchantName: string;
}

export type ReceiptClaimPreviewResult =
  | { ok: true; claim: ReceiptClaimPreview }
  | { ok: false; error: string; status: 400 | 404 | 410 };

export type ReceiptClaimLoginEmailHintResult =
  | { ok: true; emailHint: string }
  | { ok: false; error: string; status: 400 | 404 | 410 };

export type ReceiptClaimPreviewWithLoginEmailHintResult =
  | { ok: true; claim: ReceiptClaimPreview; emailHint: string }
  | { ok: false; error: string; status: 400 | 404 | 410 };

const RECEIPT_CLAIM_ACTIVITY_TIMEOUT_MS = 300;

export type ReceiptClaimActivitySource = 'app' | 'unknown' | 'web';
export type ReceiptClaimAppDownloadTarget =
  | 'app_store'
  | 'play_store'
  | 'unknown';

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

async function loadReceiptClaimRecord({
  supabase,
  token,
}: {
  supabase: SupabaseClient;
  token: string;
}): Promise<
  | { ok: true; claim: ReceiptClaimRecord }
  | { ok: false; error: string; status: 404 | 410 }
> {
  const { data, error } = await supabase.rpc('preview_receipt_claim', {
    p_token_hash: hashReceiptClaimToken(token),
  });

  if (error) {
    throw new Error(`Failed to load receipt claim: ${error.message}`);
  }

  if (!data) {
    return { error: 'Receipt claim link not found', ok: false, status: 404 };
  }

  const parsedClaim = receiptClaimRecordSchema.safeParse(data);
  if (!parsedClaim.success) {
    throw new Error('Failed to load receipt claim: invalid response structure');
  }

  const claim = parsedClaim.data;

  if (isExpired(claim.expires_at)) {
    return { error: 'Receipt claim link has expired', ok: false, status: 410 };
  }

  return { claim, ok: true };
}

export async function loadReceiptClaimPreview({
  supabase,
  token,
}: {
  supabase: SupabaseClient;
  token: string;
}): Promise<ReceiptClaimPreviewResult> {
  const record = await loadReceiptClaimRecord({ supabase, token });

  if (!record.ok) {
    return record;
  }

  return { claim: buildClaimPreview(record.claim), ok: true };
}

export async function loadReceiptClaimPreviewWithLoginEmailHint({
  supabase,
  token,
}: {
  supabase: SupabaseClient;
  token: string;
}): Promise<ReceiptClaimPreviewWithLoginEmailHintResult> {
  const record = await loadReceiptClaimRecord({ supabase, token });

  if (!record.ok) {
    return record;
  }

  return {
    claim: buildClaimPreview(record.claim),
    emailHint: sanitizeCustomerLoginEmailPrefill(record.claim.customer_email),
    ok: true,
  };
}

export async function loadReceiptClaimLoginEmailHint({
  supabase,
  token,
}: {
  supabase: SupabaseClient;
  token: string;
}): Promise<ReceiptClaimLoginEmailHintResult> {
  const record = await loadReceiptClaimRecord({ supabase, token });

  if (!record.ok) {
    return record;
  }

  return {
    emailHint: sanitizeCustomerLoginEmailPrefill(record.claim.customer_email),
    ok: true,
  };
}

async function recordReceiptClaimActivity({
  rpcName,
  source,
  supabase,
  token,
}: {
  rpcName:
    | 'record_receipt_claim_click_v2'
    | 'record_receipt_claim_login_started_v2'
    | 'record_receipt_claim_app_download_clicked_v2';
  source: ReceiptClaimActivitySource | ReceiptClaimAppDownloadTarget;
  supabase: SupabaseClient;
  token: string;
}) {
  const { error } = await supabase.rpc(rpcName, {
    p_source: source,
    p_token_hash: hashReceiptClaimToken(token),
  });

  if (error) {
    throw new Error(
      `Failed to record receipt claim activity: ${error.message}`
    );
  }
}

export async function recordReceiptClaimClick({
  source = 'web',
  supabase,
  token,
}: {
  source?: ReceiptClaimActivitySource;
  supabase: SupabaseClient;
  token: string;
}) {
  await recordReceiptClaimActivity({
    rpcName: 'record_receipt_claim_click_v2',
    source,
    supabase,
    token,
  });
}

export async function recordReceiptClaimLoginStarted({
  source = 'web',
  supabase,
  token,
}: {
  source?: ReceiptClaimActivitySource;
  supabase: SupabaseClient;
  token: string;
}) {
  await recordReceiptClaimActivity({
    rpcName: 'record_receipt_claim_login_started_v2',
    source,
    supabase,
    token,
  });
}

export async function recordReceiptClaimAppDownloadClicked({
  supabase,
  target,
  token,
}: {
  supabase: SupabaseClient;
  target: ReceiptClaimAppDownloadTarget;
  token: string;
}) {
  await recordReceiptClaimActivity({
    rpcName: 'record_receipt_claim_app_download_clicked_v2',
    source: target,
    supabase,
    token,
  });
}

async function recordReceiptClaimActivityBestEffort({
  logMessage,
  rpcName,
  source,
  supabase,
  token,
}: {
  logMessage: string;
  rpcName:
    | 'record_receipt_claim_click_v2'
    | 'record_receipt_claim_login_started_v2';
  source: ReceiptClaimActivitySource;
  supabase: SupabaseClient;
  token: string;
}) {
  const tracking = recordReceiptClaimActivity({
    rpcName,
    source,
    supabase,
    token,
  }).catch((error: unknown) => {
    console.error(logMessage, error);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      tracking,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, RECEIPT_CLAIM_ACTIVITY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function recordReceiptClaimClickBestEffort({
  source = 'web',
  supabase,
  token,
}: {
  source?: ReceiptClaimActivitySource;
  supabase: SupabaseClient;
  token: string;
}) {
  await recordReceiptClaimActivityBestEffort({
    logMessage: 'Failed to record receipt claim click',
    rpcName: 'record_receipt_claim_click_v2',
    source,
    supabase,
    token,
  });
}
