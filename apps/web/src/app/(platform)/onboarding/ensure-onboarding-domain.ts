export type OnboardingDomainEnsureResult =
  | { status: 'created' | 'already_exists' }
  | { status: 'conflict' }
  | { status: 'failed'; stage: 'read' | 'insert' | 'read_after_conflict' };

interface OnboardingDomainClient {
  from: (table: 'domains') => unknown;
}

interface EnsureOnboardingDomainInput {
  supabase: OnboardingDomainClient;
  merchantId: string;
  slug: string;
  rootDomain: string;
}

interface DomainQuery {
  select: (columns: 'merchant_id' | 'id') => {
    eq: (
      column: 'domain' | 'merchant_id',
      value: string
    ) => {
      eq?: (
        column: 'is_primary',
        value: boolean
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string } | null;
          error: unknown;
        }>;
      };
      maybeSingle: () => Promise<{
        data: { merchant_id: string } | { id: string } | null;
        error: unknown;
      }>;
    };
  };
  insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
}

function postgresCode(error: unknown): string | null {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null;
}

export async function ensureOnboardingDomain({
  supabase,
  merchantId,
  slug,
  rootDomain,
}: EnsureOnboardingDomainInput): Promise<OnboardingDomainEnsureResult> {
  const domain = `${slug}.${rootDomain}`.toLowerCase();
  const domains = supabase.from('domains') as DomainQuery;
  const existing = await domains
    .select('merchant_id')
    .eq('domain', domain)
    .maybeSingle();
  if (existing.error) return { status: 'failed', stage: 'read' };
  if (existing.data && 'merchant_id' in existing.data)
    return existing.data.merchant_id === merchantId
      ? { status: 'already_exists' }
      : { status: 'conflict' };

  const primaryQuery = domains.select('id').eq('merchant_id', merchantId);
  const primary = await primaryQuery.eq?.('is_primary', true)?.maybeSingle();
  if (!primary || primary.error) return { status: 'failed', stage: 'read' };
  const { error } = await domains.insert({
    merchant_id: merchantId,
    domain,
    tld: `.${rootDomain}`,
    domain_type: 'subdomain',
    status: 'active',
    is_primary: !primary.data,
  });
  if (!error) return { status: 'created' };
  if (postgresCode(error) !== '23505')
    return { status: 'failed', stage: 'insert' };

  const reread = await domains
    .select('merchant_id')
    .eq('domain', domain)
    .maybeSingle();
  if (reread.error) return { status: 'failed', stage: 'read_after_conflict' };
  return reread.data &&
    'merchant_id' in reread.data &&
    reread.data.merchant_id === merchantId
    ? { status: 'already_exists' }
    : { status: 'conflict' };
}
