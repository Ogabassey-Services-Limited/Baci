import 'server-only';
import { trimTrailingSlash } from '@/lib/zoho-campaigns-http';
import type { MerchantBlogRevalidationContext } from './get-merchant-blog-cache-identifiers';

const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeCustomDomainIdentifier(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed || trimmed.includes('/')) return null;

  try {
    const parsed = new URL(`https://${trimmed}`);
    const hostname = parsed.hostname;
    if (hostname !== trimmed || !hostname.includes('.')) return null;
    return HOSTNAME_PATTERN.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function buildStorefrontBlogPostUrl({
  context,
  publicBaseUrl,
  slug,
}: {
  context: MerchantBlogRevalidationContext;
  publicBaseUrl: string;
  slug: string;
}): string {
  const customDomain =
    context.identifiers
      .map((identifier) => normalizeCustomDomainIdentifier(identifier))
      .find((identifier): identifier is string => Boolean(identifier)) ?? null;
  const origin = customDomain
    ? `https://${customDomain}`
    : trimTrailingSlash(publicBaseUrl);
  const pathPrefix =
    customDomain || !context.canonicalMerchantSlug
      ? ''
      : `/${context.canonicalMerchantSlug}`;

  return `${trimTrailingSlash(origin)}${pathPrefix}/blog/${encodeURIComponent(slug)}`;
}
