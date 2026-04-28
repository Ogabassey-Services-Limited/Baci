import { STOREFRONT_POLICY_ROUTES } from '@/config/storefront-policy-routes';
import { getProductUrl } from '@/lib/seo-utils';

type AgentProductUrlInput = {
  baseUrl: string;
  product: {
    id: string;
    slug?: string | null;
    name: string;
    category?: string | null;
    category_slug?: string | null;
    canonical_url?: string | null;
    categories?: { name?: string | null; slug?: string | null } | null;
  };
};

export type AgentPolicyUrls = {
  privacy_policy_url: string;
  return_policy_url: string;
  shipping_policy_url: string;
  terms_of_service_url: string;
};

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .map((segment, index) =>
      index === 0 ? segment : encodePathSegment(segment)
    )
    .join('/');
}

export function buildAgentProductUrl({
  baseUrl,
  product,
}: AgentProductUrlInput): string {
  if (!product) {
    throw new TypeError('Agent product URL requires a product.');
  }

  if (!product.id || !product.name) {
    throw new TypeError('Agent product URL requires product id and name.');
  }

  const productPath = getProductUrl({
    id: product.id,
    name: product.name,
    slug: product.slug ?? undefined,
    category: product.category ?? null,
    category_slug: product.category_slug ?? undefined,
    canonical_url: product.canonical_url ?? null,
    categories: product.categories
      ? {
          name: product.categories.name ?? undefined,
          slug: product.categories.slug ?? undefined,
        }
      : null,
  });

  return `${trimTrailingSlash(baseUrl)}${encodePathSegments(productPath)}`;
}

export function buildAgentPolicyUrls(baseUrl: string): AgentPolicyUrls {
  const root = trimTrailingSlash(baseUrl);

  return {
    privacy_policy_url: `${root}${STOREFRONT_POLICY_ROUTES.privacy}`,
    return_policy_url: `${root}${STOREFRONT_POLICY_ROUTES.returns}`,
    shipping_policy_url: `${root}${STOREFRONT_POLICY_ROUTES.shipping}`,
    terms_of_service_url: `${root}${STOREFRONT_POLICY_ROUTES.terms}`,
  };
}
