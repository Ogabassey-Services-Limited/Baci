import { headers } from 'next/headers';
import type {
  StorefrontShellSnapshot,
  StorefrontShellSnapshotBase,
} from '@/hooks/merchant/types';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { isDomainIdentifier } from '@/lib/validation';

export async function getStorefrontShellSnapshotBase(
  slug: string
): Promise<StorefrontShellSnapshotBase | null> {
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return null;
  }

  const headersList = await headers();
  const hasSubdomain = headersList.has('x-merchant-slug');
  const hasCustomDomain = headersList.has('x-custom-domain');
  const routingMode =
    hasSubdomain || hasCustomDomain || isDomainIdentifier(slug)
      ? 'domain'
      : 'path';
  const merchantData = toTemplateMerchantData(merchant);

  return {
    merchant: merchantData,
    routingMode,
    basePath: routingMode === 'domain' ? '' : `/${merchant.slug}`,
  };
}

export async function getStorefrontShellSnapshot(
  slugOrBaseSnapshot: string | StorefrontShellSnapshotBase
): Promise<StorefrontShellSnapshot | null> {
  const shellSnapshotBase =
    typeof slugOrBaseSnapshot === 'string'
      ? await getStorefrontShellSnapshotBase(slugOrBaseSnapshot)
      : slugOrBaseSnapshot;

  if (!shellSnapshotBase) {
    return null;
  }

  const navigationCategories = await getCachedNavigationCategories(
    shellSnapshotBase.merchant.id
  );

  return {
    ...shellSnapshotBase,
    navigationCategories,
  };
}
