import {
  getAdminMerchantHealthRows,
  sortAdminMerchantHealthRows,
} from '@/lib/admin-merchant-health';
import { getFirstSearchParam } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';
import type { HealthFilter } from './merchants-client';
import { MerchantsClient } from './merchants-client';

type MerchantsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VALID_HEALTH_FILTERS = new Set<HealthFilter>([
  'all',
  'healthy',
  'at_risk',
  'churned',
  'new',
]);

export function isHealthFilter(value: string): value is HealthFilter {
  return VALID_HEALTH_FILTERS.has(value as HealthFilter);
}

export default async function MerchantsPage({
  searchParams,
}: MerchantsPageProps) {
  const params = await searchParams;
  const health = getFirstSearchParam(params.health) ?? 'all';
  const initialHealthFilter = isHealthFilter(health) ? health : 'all';
  const supabase = await createClient();
  const { data, error } = await getAdminMerchantHealthRows(supabase);

  if (error) {
    console.error('Admin merchants initial load error:', error);
  }

  const initialMerchants = sortAdminMerchantHealthRows(data ?? [], 'gmv');

  return (
    <MerchantsClient
      initialError={error ? 'Failed to load merchant data.' : null}
      initialHealthFilter={initialHealthFilter}
      initialMerchants={initialMerchants}
    />
  );
}
