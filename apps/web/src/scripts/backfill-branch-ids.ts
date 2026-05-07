import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

type ActiveBranchRow = {
  active: boolean;
  id: string;
  merchant_id: string;
};

export type BackfillDecision =
  | {
      action: 'assign_single_active_branch';
      branchId: string;
      merchantId: string;
    }
  | {
      action: 'skip_multiple_active_branches';
      activeBranchCount: number;
      merchantId: string;
    }
  | {
      action: 'skip_no_active_branch';
      merchantId: string;
    };

type BackfillUpdates = {
  expenses: number;
  orders: number;
  variantInventory: number;
};

type BackfillRpcRow = {
  expenses_count: number;
  orders_count: number;
  variant_inventory_count: number;
};

type BranchBackfillResult = {
  decision: BackfillDecision;
  dryRun: boolean;
  updates: BackfillUpdates | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function decideBranchBackfill(
  merchantId: string,
  activeBranches: ActiveBranchRow[]
): BackfillDecision {
  if (activeBranches.length === 0) {
    return { action: 'skip_no_active_branch', merchantId };
  }

  if (activeBranches.length > 1) {
    return {
      action: 'skip_multiple_active_branches',
      merchantId,
      activeBranchCount: activeBranches.length,
    };
  }

  return {
    action: 'assign_single_active_branch',
    merchantId,
    branchId: activeBranches[0].id,
  };
}

async function fetchActiveBranches(
  supabase: Pick<SupabaseClient, 'from'>,
  merchantId: string
): Promise<ActiveBranchRow[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, merchant_id, active')
    .eq('merchant_id', merchantId)
    .eq('active', true);

  if (error) {
    throw new Error(`Failed to fetch active branches: ${error.message}`);
  }

  return (data ?? []) as ActiveBranchRow[];
}

export async function applyBranchBackfill(
  supabase: Pick<SupabaseClient, 'rpc'>,
  decision: Extract<
    BackfillDecision,
    { action: 'assign_single_active_branch' }
  >
): Promise<BackfillUpdates> {
  const { data, error } = await supabase.rpc(
    'backfill_branch_scope_for_single_active_branch',
    {
      p_branch_id: decision.branchId,
      p_merchant_id: decision.merchantId,
    }
  );

  if (error) {
    throw new Error(`Failed to backfill branch ids: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | BackfillRpcRow
    | null
    | undefined;

  if (!row) {
    throw new Error('Branch backfill RPC returned no update counts');
  }

  if (
    typeof row.orders_count !== 'number' ||
    typeof row.variant_inventory_count !== 'number' ||
    typeof row.expenses_count !== 'number'
  ) {
    throw new Error('Branch backfill RPC returned invalid update counts');
  }

  return {
    orders: row.orders_count,
    variantInventory: row.variant_inventory_count,
    expenses: row.expenses_count,
  };
}

export async function evaluateMerchantBranchBackfill(
  supabase: Pick<SupabaseClient, 'from' | 'rpc'>,
  merchantId: string,
  options: { apply: boolean }
): Promise<BranchBackfillResult> {
  const branches = await fetchActiveBranches(supabase, merchantId);
  const decision = decideBranchBackfill(merchantId, branches);

  if (!options.apply || decision.action !== 'assign_single_active_branch') {
    return {
      decision,
      dryRun: !options.apply,
      updates: null,
    };
  }

  return {
    decision,
    dryRun: false,
    updates: await applyBranchBackfill(supabase, decision),
  };
}

function parseArgs(args: string[]) {
  const merchantIndex = args.indexOf('--merchant');
  const merchant = merchantIndex >= 0 ? args[merchantIndex + 1] : null;

  if (!merchant || merchant.startsWith('--')) {
    throw new Error('Usage: backfill-branch-ids --merchant <slug|id|domain> [--apply]');
  }

  return {
    apply: args.includes('--apply'),
    merchant,
  };
}

async function resolveMerchantId(
  supabase: Pick<SupabaseClient, 'from'>,
  merchant: string
): Promise<string> {
  if (UUID_RE.test(merchant)) {
    return merchant;
  }

  if (DOMAIN_RE.test(merchant)) {
    const normalizedDomain = merchant.toLowerCase().replace(/^www\./, '');
    const { data, error } = await supabase
      .from('domains')
      .select('merchant_id')
      .eq('domain', normalizedDomain)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve merchant domain: ${error.message}`);
    }

    if (!data?.merchant_id) {
      throw new Error(`Merchant domain not found: ${merchant}`);
    }

    return data.merchant_id;
  }

  const { data, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', merchant)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve merchant slug: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Merchant not found: ${merchant}`);
  }

  return data.id;
}

export async function runBranchBackfillCli(
  args = process.argv.slice(2),
  supabase = createServiceClient()
): Promise<number> {
  const parsed = parseArgs(args);
  const merchantId = await resolveMerchantId(supabase, parsed.merchant);
  const result = await evaluateMerchantBranchBackfill(supabase, merchantId, {
    apply: parsed.apply,
  });

  console.log(
    JSON.stringify(
      {
        merchant: parsed.merchant,
        merchantId,
        ...result,
      },
      null,
      2
    )
  );

  return 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runBranchBackfillCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
