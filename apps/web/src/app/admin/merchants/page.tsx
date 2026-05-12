import {
  getAdminMerchantHealthRows,
  sortAdminMerchantHealthRows,
} from '@/lib/admin-merchant-health';
import { getFirstSearchParam } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';
import { isHealthFilter } from './merchant-health-filter';
import { MerchantsClient } from './merchants-client';

type MerchantsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
