import type { Route } from 'next';
import { getStorefrontShellSnapshotBase } from '@/app/(storefront)/[slug]/storefront-shell-snapshot';
import { asRoute } from '@/lib/routes';
import { isDomainIdentifier } from '@/lib/validation';

interface LegacyAccountRedirectInput {
  slug: string;
  segments?: readonly string[];
}

export async function resolveLegacyAccountRedirectPath({
  slug,
  segments = [],
}: LegacyAccountRedirectInput): Promise<Route> {
  const shellSnapshotBase = await getStorefrontShellSnapshotBase(slug);
  const fallbackBasePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const basePath = shellSnapshotBase?.basePath ?? fallbackBasePath;
  const accountSegments = segments
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const accountPath = accountSegments
    ? `/account/${accountSegments}`
    : '/account';

  return asRoute(`${basePath}${accountPath}`);
}
