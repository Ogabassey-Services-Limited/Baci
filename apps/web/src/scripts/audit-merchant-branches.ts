import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

type BranchAuditRow = {
  active: boolean;
  id: string;
  is_default: boolean;
  name: string;
};

type ListedBranch = {
  id: string;
  name: string;
};

type ActiveListedBranch = ListedBranch & {
  isDefault: boolean;
};

type BranchAudit = {
  activeBranches: ActiveListedBranch[];
  activeFlaggedBranches: ListedBranch[];
  hasActiveCleanupFailure: boolean;
  inactiveFlaggedBranches: ListedBranch[];
};

const BRANCH_NAME_CLEANUP_RE = /\b(?:test|demo|sample)\b/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function auditMerchantBranches(branches: BranchAuditRow[]): BranchAudit {
  const activeBranches = branches
    .filter((branch) => branch.active)
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      isDefault: branch.is_default,
    }));
  const flaggedBranches = branches
    .filter((branch) => BRANCH_NAME_CLEANUP_RE.test(branch.name))
    .map((branch) => ({
      active: branch.active,
      id: branch.id,
      name: branch.name,
    }));
  const activeFlaggedBranches = flaggedBranches
    .filter((branch) => branch.active)
    .map(({ id, name }) => ({ id, name }));
  const inactiveFlaggedBranches = flaggedBranches
    .filter((branch) => !branch.active)
    .map(({ id, name }) => ({ id, name }));

  return {
    activeBranches,
    activeFlaggedBranches,
    inactiveFlaggedBranches,
    hasActiveCleanupFailure: activeFlaggedBranches.length > 0,
  };
}

async function fetchMerchantBranches(
  supabase: Pick<SupabaseClient, 'from'>,
  merchantId: string
): Promise<BranchAuditRow[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, active, is_default')
    .eq('merchant_id', merchantId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch branches: ${error.message}`);
  }

  return (data ?? []) as BranchAuditRow[];
}

function parseArgs(args: string[]) {
  const merchantIndex = args.indexOf('--merchant');
  const merchant = merchantIndex >= 0 ? args[merchantIndex + 1] : null;

  if (!merchant || merchant.startsWith('--')) {
    throw new Error(
      'Usage: audit-merchant-branches --merchant <slug|id|domain>'
    );
  }

  return {
    merchant,
  };
}

async function resolveMerchantId(
  supabase: Pick<SupabaseClient, 'from'>,
  merchant: string
): Promise<string> {
  if (UUID_RE.test(merchant)) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', merchant)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve merchant id: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error(`Merchant not found: ${merchant}`);
    }

    return data.id;
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

export async function runMerchantBranchAuditCli(
  args = process.argv.slice(2),
  supabase = createAdminClient()
): Promise<number> {
  const parsed = parseArgs(args);
  const merchantId = await resolveMerchantId(supabase, parsed.merchant);
  const branches = await fetchMerchantBranches(supabase, merchantId);
  const audit = auditMerchantBranches(branches);

  console.log(
    JSON.stringify(
      {
        merchant: parsed.merchant,
        merchantId,
        ...audit,
      },
      null,
      2
    )
  );

  return audit.hasActiveCleanupFailure ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runMerchantBranchAuditCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
