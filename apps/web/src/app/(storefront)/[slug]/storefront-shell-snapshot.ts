import { headers } from 'next/headers';
import type {
  StorefrontShellSnapshot,
  StorefrontShellSnapshotBase,
} from '@/hooks/merchant/types';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { isDomainIdentifier } from '@/lib/validation';

type RoutingMode = 'domain' | 'path';

function shouldFallbackToPathRouting(error: unknown): boolean {
  const digest =
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string'
      ? (error as { digest: string }).digest
      : null;

  return (
    digest === 'HANGING_PROMISE_REJECTION' ||
    digest === 'NEXT_PRERENDER_INTERRUPTED'
  );
}

async function resolveRoutingMode(slug: string): Promise<RoutingMode> {
  if (isDomainIdentifier(slug)) {
    return 'domain';
  }

  try {
    const headersList = await headers();
    return headersList.has('x-merchant-slug') ||
      headersList.has('x-custom-domain')
      ? 'domain'
      : 'path';
  } catch (error) {
    if (shouldFallbackToPathRouting(error)) {
      return 'path';
    }

    throw error;
  }
}

export async function getStorefrontShellSnapshotBase(
  slug: string
): Promise<StorefrontShellSnapshotBase | null> {
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return null;
  }

  const routingMode = await resolveRoutingMode(slug);
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
