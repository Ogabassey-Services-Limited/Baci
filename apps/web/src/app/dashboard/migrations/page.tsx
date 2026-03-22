import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import type { ImportJobListItem } from './migration-types';
import MigrationsClientPage from './migrations-client-page';

export const metadata = {
  title: 'Migrations - Baci',
};

export default async function MigrationsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <MigrationsClientPage initialError={null} initialJobs={[]} />;
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase
    .from('import_jobs')
    .select(
      'id, entity_type, source_platform, status, original_filename, total_rows, processed_rows, summary, error, created_at, committed_at, notified_at, completed_at'
    )
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    logger.error({
      message: 'Failed to load dashboard import jobs',
      error,
      merchantId: merchant.id,
    });
    return (
      <MigrationsClientPage
        initialError="Failed to load migration jobs."
        initialJobs={[]}
      />
    );
  }

  return (
    <MigrationsClientPage
      initialError={null}
      initialJobs={(data || []) as ImportJobListItem[]}
    />
  );
}
