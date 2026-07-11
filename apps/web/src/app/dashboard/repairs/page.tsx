import { cookies } from 'next/headers';
import type { StaffAccess } from '@/hooks/merchant';
import { ensurePermission } from '@/lib/merchant-server';
import { isRepairsBusinessType } from '@/lib/repairs/repairs-feature';
import { createClient } from '@/lib/supabase/server';
import RepairsCatalogClient from './repairs-catalog-client';
import RepairsUnavailable from './repairs-unavailable';

export const metadata = {
  title: 'Repairs - Baci',
};

function hasRepairsPermission(staffAccess: StaffAccess, action: string) {
  return (
    staffAccess.isOwner ||
    staffAccess.permissions?.full_access?.all === true ||
    staffAccess.permissions?.repairs?.all === true ||
    staffAccess.permissions?.repairs?.[action] === true
  );
}

export default async function RepairsPage() {
  let merchantId: string;
  let businessType: string;
  let canEdit = false;
  let canDelete = false;
  try {
    const { merchant, staffAccess } = await ensurePermission('repairs', 'view');
    merchantId = merchant.id;
    businessType = merchant.business_type;
    canEdit = hasRepairsPermission(staffAccess, 'edit');
    canDelete = hasRepairsPermission(staffAccess, 'delete');
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

  return (
    <RepairsCatalogClient
      canEdit={canEdit}
      canDelete={canDelete}
      catalogPubliclyEnabled={data?.repairs_catalog_enabled === true}
    />
  );
}
