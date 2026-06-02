import type { Route } from 'next';
import { getStorefrontShellSnapshotBase } from '@/app/(storefront)/[slug]/storefront-shell-snapshot';
import { asRoute } from '@/lib/routes';
import { isDomainIdentifier } from '@/lib/validation';

type LegacyAccountSearchParams = Record<string, string | string[] | undefined>;

interface LegacyAccountRedirectInput {
  searchParams?: LegacyAccountSearchParams;
  slug: string;
  segments?: readonly string[];
}

function serializeSearchParams(
  searchParams: LegacyAccountSearchParams | undefined
): string {
  if (!searchParams) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    params.append(key, value);
  }

  return params.toString();
}

export async function resolveLegacyAccountRedirectPath({
  searchParams,
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
  const queryString = serializeSearchParams(searchParams);

  return asRoute(
    `${basePath}${accountPath}${queryString ? `?${queryString}` : ''}`
  );
}
