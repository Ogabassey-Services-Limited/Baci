import { cookies } from 'next/headers';
import { ensurePermission } from '@/lib/merchant-server';
import { isRepairsBusinessType } from '@/lib/repairs/repairs-feature';
import { createClient } from '@/lib/supabase/server';
import RepairsCatalogClient from './repairs-catalog-client';
import RepairsUnavailable from './repairs-unavailable';

export const metadata = {
  title: 'Repairs - Baci',
};

export default async function RepairsPage() {
  let merchantId: string;
  let businessType: string;
  try {
    const { merchant } = await ensurePermission('repairs', 'view');
    merchantId = merchant.id;
    businessType = merchant.business_type;
  } catch {
    return <RepairsUnavailable reason="permission" />;
  }

  if (!isRepairsBusinessType(businessType)) {
    return <RepairsUnavailable reason="business-type" />;
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase
    .from('merchant_feature_settings')
    .select('repairs_catalog_enabled')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (data?.repairs_catalog_enabled !== true) {
    return <RepairsUnavailable reason="disabled" />;
  }

  return <RepairsCatalogClient />;
}
