import type { SupabaseClient } from '@supabase/supabase-js';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

const RECEIPT_CLAIM_ACTIVITY_TIMEOUT_MS = 300;

export type ReceiptClaimActivitySource = 'app' | 'unknown' | 'web';
export type ReceiptClaimAppDownloadTarget =
  | 'app_store'
  | 'play_store'
  | 'unknown';

type ReceiptClaimActivityRpcName =
  | 'record_receipt_claim_click_v2'
  | 'record_receipt_claim_login_started_v2';

type ReceiptClaimSourceInput = {
  source?: ReceiptClaimActivitySource;
  supabase: SupabaseClient;
  token: string;
};

type SupabaseRpcError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseRpcResponse = Awaited<ReturnType<SupabaseClient['rpc']>>;

type RecordReceiptClaimActivityInput = {
  supabase: SupabaseClient;
  token: string;
} & (
  | {
      rpcName: ReceiptClaimActivityRpcName;
      source: ReceiptClaimActivitySource;
    }
  | {
      rpcName: 'record_receipt_claim_app_download_clicked_v2';
      source: ReceiptClaimAppDownloadTarget;
    }
);

type RecordReceiptClaimActivityBestEffortInput = ReceiptClaimSourceInput & {
  logMessage: string;
  rpcName: ReceiptClaimActivityRpcName;
  source: ReceiptClaimActivitySource;
};

const LEGACY_ACTIVITY_RPC_NAMES = {
  record_receipt_claim_click_v2: 'record_receipt_claim_click',
  record_receipt_claim_login_started_v2: 'record_receipt_claim_login_started',
} satisfies Record<ReceiptClaimActivityRpcName, string>;

function isMissingRpcFunction(error: SupabaseRpcError | null, rpcName: string) {
  if (!error) {
    return false;
  }

  if (error.code === 'PGRST202' || error.code === '42883') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes(rpcName.toLowerCase()) &&
    (message.includes('could not find') ||
      message.includes('does not exist') ||
      message.includes('function'))
  );
}

async function fallbackToLegacyActivityRpc({
  rpcName,
  supabase,
  tokenHash,
}: {
  rpcName: ReceiptClaimActivityRpcName;
  supabase: SupabaseClient;
  tokenHash: string;
}): Promise<SupabaseRpcResponse> {
  return await supabase.rpc(LEGACY_ACTIVITY_RPC_NAMES[rpcName], {
    p_token_hash: tokenHash,
  });
}

async function recordReceiptClaimActivity({
  rpcName,
  source,
  supabase,
  token,
}: RecordReceiptClaimActivityInput) {
  const tokenHash = hashReceiptClaimToken(token);
  let response = await supabase.rpc(rpcName, {
    p_source: source,
    p_token_hash: tokenHash,
  });

  if (
    rpcName !== 'record_receipt_claim_app_download_clicked_v2' &&
    isMissingRpcFunction(response.error, rpcName)
  ) {
    response = await fallbackToLegacyActivityRpc({
      rpcName,
      supabase,
      tokenHash,
    });
  }

  if (response.error) {
    throw new Error(
      `Failed to record receipt claim activity: ${response.error.message}`
    );
  }
}

export async function recordReceiptClaimClick({
  source = 'web',
  supabase,
  token,
}: ReceiptClaimSourceInput) {
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
}: ReceiptClaimSourceInput) {
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
}: RecordReceiptClaimActivityBestEffortInput) {
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
}: ReceiptClaimSourceInput) {
  await recordReceiptClaimActivityBestEffort({
    logMessage: 'Failed to record receipt claim click',
    rpcName: 'record_receipt_claim_click_v2',
    source,
    supabase,
    token,
  });
}

export async function recordReceiptClaimLoginStartedBestEffort({
  source = 'web',
  supabase,
  token,
}: ReceiptClaimSourceInput) {
  await recordReceiptClaimActivityBestEffort({
    logMessage: 'Failed to record receipt claim login start',
    rpcName: 'record_receipt_claim_login_started_v2',
    source,
    supabase,
    token,
  });
}
