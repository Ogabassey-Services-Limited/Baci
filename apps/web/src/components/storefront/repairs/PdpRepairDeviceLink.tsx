import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { isRepairsCatalogEnabled } from '@/lib/repairs/repairs-feature';
import { asRoute, joinRouteBasePath } from '@/lib/routes';

interface PdpRepairDeviceLinkMerchant {
  id: string;
  business_type: string;
  feature_settings?: { repairs_catalog_enabled?: boolean } | null;
}

interface PdpRepairDeviceLinkProps {
  merchant: PdpRepairDeviceLinkMerchant;
  productId: string;
  basePath: string;
}

async function findLinkedDeviceSlug(
  merchantId: string,
  productId: string
): Promise<string | null> {
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from('repair_devices')
      .select('slug')
      .eq('merchant_id', merchantId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const slug = (data as { slug: unknown }).slug;
    return typeof slug === 'string' && slug.length > 0 ? slug : null;
  } catch (lookupError) {
    console.error('Error resolving PDP repair device link:', lookupError);
    return null;
  }
}

/**
 * Small, server-rendered "Repair this device" link shown on product pages
 * whose product is linked to a repairs-catalogue device. Feature-gated;
 * fails open (renders nothing) on any error so it can never break the PDP.
 * No client JS, no layout shift — safe for LCP-sensitive PDP territory.
 */
export async function PdpRepairDeviceLink({
  basePath,
  merchant,
  productId,
}: PdpRepairDeviceLinkProps) {
  if (
    !isRepairsCatalogEnabled({
      businessType: merchant.business_type,
      repairsCatalogEnabled: merchant.feature_settings?.repairs_catalog_enabled,
    })
  ) {
    return null;
  }

  const deviceSlug = await findLinkedDeviceSlug(merchant.id, productId);
  if (!deviceSlug) {
    return null;
  }

  return (
    <Link
      className="inline-flex items-center gap-1.5 text-sm font-medium text-store-primary underline-offset-2 hover:underline"
      href={asRoute(`${joinRouteBasePath(basePath, '/repairs')}/${deviceSlug}`)}
    >
      <Wrench aria-hidden="true" size={14} />
      Repair this device
    </Link>
  );
}
