import type { FeedProduct } from '@/app/api/feed/google-merchant/feed-builder';
import type { GoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import type { OpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import { resolveGmcPrimaryImage } from '@/lib/gmc-feed-images';
import {
  buildAgentPolicyUrls,
  buildAgentProductUrl,
  trimTrailingSlash,
} from '@/lib/storefront-agent-urls';
import { buildAgentCommerceTrustHealthSignals } from './agent-commerce-trust-health-signals';
import {
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
} from './build-merchant-trust-profile';
import { getTrustCoverageSeverity } from './get-trust-coverage-severity';
import { isPresentString } from './is-present-string';
import { isValidHttpUrl } from './is-valid-http-url';
import type { MerchantTrustProfile } from './merchant-trust-profile-types';

export type AgentCommerceTrustSeverity = 'pass' | 'warn' | 'fail';

export interface AgentCommerceTrustCheck {
  id:
    | 'catalog-surface-parity'
    | 'canonical-url-parity'
    | 'price-parity'
    | 'verified-image-coverage'
    | 'policy-coverage'
    | 'support-contact'
    | 'structured-data-readiness'
    | 'review-signal-coverage'
    | 'feed-freshness'
    | 'crawler-visibility'
    | 'machine-endpoint-discovery';
  label: string;
  severity: AgentCommerceTrustSeverity;
  message: string;
  next_step?: string;
  next_step_url?: string;
  affectedProductIds?: string[];
  affectedProductCount?: number;
}

export interface AgentCommerceTrustReadiness {
  checks: AgentCommerceTrustCheck[];
  status: AgentCommerceTrustSeverity;
  surfaces: {
    agentCommerceManifest: string;
    agentNativeCommerce: string;
    agentTrust: string;
    currentProductFeed: string;
    googleMerchantXml: string;
    openAiProductFeed: string;
    productApi: string;
    llms: string;
    policies: ReturnType<typeof buildAgentPolicyUrls>;
    robots: string;
    sitemap: string;
    ucpProfile: string;
  };
  totals: {
    googleProducts: number;
    openAiProducts: number;
    sharedProducts: number;
    urlMismatches: number;
    priceMismatches: number;
    productsWithVerifiedImages: number;
    latestProductUpdatedAt: string | null;
    productsWithStructuredData: number;
    staleProducts: number;
  };
}

/**
 * Aggregate-only projection of {@link AgentCommerceTrustReadiness} that is safe
 * to serialize into client component props. It deliberately omits the per-check
 * `affectedProductIds` arrays (which can carry thousands of IDs for large
 * catalogs) and the `surfaces` map, keeping only the counts/status/severity the
 * dashboard trust card actually renders.
 */
export interface AgentCommerceTrustCheckSummary {
  id: AgentCommerceTrustCheck['id'];
  label: string;
  severity: AgentCommerceTrustSeverity;
  message: string;
  next_step?: string;
  next_step_url?: string;
  affectedProductCount?: number;
}

const TRUST_CHECK_ACTIONS: Record<
  AgentCommerceTrustCheck['id'],
  {
    nextStep: string;
    nextStepUrl: string;
  }
> = {
  'catalog-surface-parity': {
    nextStep:
      'Open Products and publish any items missing across feed surfaces.',
    nextStepUrl: '/dashboard/products',
  },
  'canonical-url-parity': {
    nextStep:
      'Open SEO settings and align canonical product URLs used by storefront feeds.',
    nextStepUrl: '/dashboard/seo',
  },
  'price-parity': {
    nextStep:
      'Open Products and align feed prices with the storefront checkout price.',
    nextStepUrl: '/dashboard/products',
  },
  'verified-image-coverage': {
    nextStep:
      'Open Products and add valid product media for missing feed image slots.',
    nextStepUrl: '/dashboard/products',
  },
  'policy-coverage': {
    nextStep:
      'Open Trust settings and publish missing return, shipping, privacy, or terms policies.',
    nextStepUrl: '/dashboard/settings/trust',
  },
  'support-contact': {
    nextStep:
      'Open Trust settings and add a support email, phone number, or WhatsApp contact.',
    nextStepUrl: '/dashboard/settings/trust',
  },
  'structured-data-readiness': {
    nextStep:
      'Open Products and complete key fields used by JSON-LD and agent catalog surfaces.',
    nextStepUrl: '/dashboard/products',
  },
  'review-signal-coverage': {
    nextStep:
      'Open Reviews and approve/curate product reviews so agent consumers can trust rating signals.',
    nextStepUrl: '/dashboard/reviews',
  },
  'feed-freshness': {
    nextStep:
      'Open Products and refresh stale catalog items so feed timestamps stay current.',
    nextStepUrl: '/dashboard/products',
  },
  'crawler-visibility': {
    nextStep:
      'Open SEO settings and verify robots, sitemap, and llms routes are reachable.',
    nextStepUrl: '/dashboard/seo',
  },
  'machine-endpoint-discovery': {
    nextStep:
      'Open Trust settings and correct malformed agent manifest, feed, or policy URLs.',
    nextStepUrl: '/dashboard/settings/trust',
  },
};

function withTrustActionGuidance(
  check: AgentCommerceTrustCheck
): AgentCommerceTrustCheck {
  const action = TRUST_CHECK_ACTIONS[check.id];
  return action
    ? {
        ...check,
        next_step: action.nextStep,
        next_step_url: action.nextStepUrl,
      }
    : check;
}

export interface AgentCommerceTrustReadinessSummary {
  checks: AgentCommerceTrustCheckSummary[];
  status: AgentCommerceTrustSeverity;
  totals: AgentCommerceTrustReadiness['totals'];
}

export function summarizeAgentCommerceTrustReadiness(
  readiness: AgentCommerceTrustReadiness
): AgentCommerceTrustReadinessSummary {
  return {
    status: readiness.status,
    totals: readiness.totals,
    checks: readiness.checks.map((check) => ({
      id: check.id,
      label: check.label,
      severity: check.severity,
      message: check.message,
      next_step: check.next_step,
      next_step_url: check.next_step_url,
      affectedProductCount:
        check.affectedProductCount ?? check.affectedProductIds?.length,
    })),
  };
}

interface BuildAgentCommerceTrustReadinessInput {
  baseUrl: string;
  googleFeedData: GoogleMerchantFeedData;
  merchant: {
    business_name: string;
    slug: string;
  };
  now?: Date;
  openAiFeedData: OpenAIFeedData;
  trustProfile: MerchantTrustProfile;
}

function buildSurfaceUrls(baseUrl: string, slug: string) {
  const root = trimTrailingSlash(baseUrl);

  return {
    agentCommerceManifest: `${root}${STOREFRONT_AGENT_ROUTES.manifest}`,
    agentNativeCommerce: `${root}${STOREFRONT_AGENT_ROUTES.agentNativeCommerce}`,
    agentTrust: `${root}${STOREFRONT_AGENT_ROUTES.trust}`,
    currentProductFeed: `${root}${STOREFRONT_FEED_ROUTES.agentProducts}`,
    googleMerchantXml: `${root}${STOREFRONT_FEED_ROUTES.googleMerchantXml}`,
    openAiProductFeed: `${root}${STOREFRONT_FEED_ROUTES.openaiProductFeed}`,
    productApi: `${root}/api/storefront/${encodeURIComponent(slug)}/products`,
    llms: `${root}/llms.txt`,
    policies: buildAgentPolicyUrls(root),
    robots: `${root}/robots.txt`,
    sitemap: `${root}/sitemap.xml`,
    ucpProfile: `${root}${STOREFRONT_AGENT_ROUTES.ucpProfile}`,
  };
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function getStatus(
  checks: AgentCommerceTrustCheck[]
): AgentCommerceTrustSeverity {
  if (checks.some((check) => check.severity === 'fail')) return 'fail';
  if (checks.some((check) => check.severity === 'warn')) return 'warn';
  return 'pass';
}

function findCatalogSurfaceGaps({
  googleProductsById,
  openAiProductsById,
}: {
  googleProductsById: Map<string, FeedProduct>;
  openAiProductsById: Map<string, OpenAIFeedData['products'][number]>;
}): string[] {
  const gaps = new Set<string>();

  for (const id of openAiProductsById.keys()) {
    if (!googleProductsById.has(id)) gaps.add(id);
  }

  for (const id of googleProductsById.keys()) {
    if (!openAiProductsById.has(id)) gaps.add(id);
  }

  return [...gaps].sort();
}

export function buildAgentCommerceTrustReadiness({
  baseUrl,
  googleFeedData,
  merchant,
  now,
  openAiFeedData,
  trustProfile,
}: BuildAgentCommerceTrustReadinessInput): AgentCommerceTrustReadiness {
  const googleProductsById = indexById(googleFeedData.products);
  const openAiProductsById = indexById(openAiFeedData.products);
  const sharedProductIds = [...openAiProductsById.keys()]
    .filter((id) => googleProductsById.has(id))
    .sort();

  const catalogGaps = findCatalogSurfaceGaps({
    googleProductsById,
    openAiProductsById,
  });

  const urlMismatches = sharedProductIds.filter((id) => {
    const openAiProduct = openAiProductsById.get(id);
    const googleProduct = googleProductsById.get(id);
    if (!openAiProduct || !googleProduct) return false;

    return (
      buildAgentProductUrl({ baseUrl, product: openAiProduct }) !==
      buildAgentProductUrl({ baseUrl, product: googleProduct })
    );
  });

  const priceMismatches = sharedProductIds.filter((id) => {
    const openAiProduct = openAiProductsById.get(id);
    const googleProduct = googleProductsById.get(id);
    if (!openAiProduct || !googleProduct) return false;

    return Number(openAiProduct.price) !== Number(googleProduct.price);
  });

  const productsWithVerifiedImages = openAiFeedData.products.filter(
    (product) => {
      const imageUrl = resolveGmcPrimaryImage(
        googleFeedData.imageManifest[product.id] ?? []
      );
      return imageUrl ? isValidHttpUrl(imageUrl) : false;
    }
  ).length;

  const surfaces = buildSurfaceUrls(baseUrl, merchant.slug);
  const healthSignals = buildAgentCommerceTrustHealthSignals({
    now,
    openAiProducts: openAiFeedData.products,
    surfaces,
  });
  const surfaceUrls = [
    surfaces.agentCommerceManifest,
    surfaces.agentNativeCommerce,
    surfaces.agentTrust,
    surfaces.currentProductFeed,
    surfaces.googleMerchantXml,
    surfaces.openAiProductFeed,
    surfaces.productApi,
    surfaces.llms,
    ...Object.values(surfaces.policies),
    surfaces.robots,
    surfaces.sitemap,
    surfaces.ucpProfile,
  ];
  const validSurfaceUrls = surfaceUrls.filter(isValidHttpUrl).length;
  const hasPublishedReturnPolicyLink =
    hasPublishableReturnsPolicy(trustProfile) &&
    isValidHttpUrl(trustProfile.derivedLinks.returns ?? '');
  const hasPublishedShippingPolicyLink =
    hasPublishableShippingPolicy(trustProfile) &&
    isValidHttpUrl(trustProfile.derivedLinks.shipping ?? '');
  const hasPublishedPrivacyPolicyLink = isValidHttpUrl(
    trustProfile.derivedLinks.privacy ?? ''
  );
  const hasPublishedTermsLink = isValidHttpUrl(
    trustProfile.derivedLinks.terms ?? ''
  );
  const publishedPolicyLinksCount = [
    hasPublishedReturnPolicyLink,
    hasPublishedShippingPolicyLink,
    hasPublishedPrivacyPolicyLink,
    hasPublishedTermsLink,
  ].filter(Boolean).length;
  const requiredPolicyLinksCount = 4;
  const hasSupportContact = [
    trustProfile.supportEmail,
    trustProfile.supportPhone,
    trustProfile.whatsappNumber,
  ].some(isPresentString);

  const checkCandidates: AgentCommerceTrustCheck[] = [
    {
      id: 'catalog-surface-parity',
      label: 'Catalog surface parity',
      severity: catalogGaps.length === 0 ? 'pass' : 'fail',
      message:
        catalogGaps.length === 0
          ? `${sharedProductIds.length} products are present across agent and Google feed sources.`
          : `${catalogGaps.length} products are missing from one machine-readable catalog surface.`,
      affectedProductIds: catalogGaps.length > 0 ? catalogGaps : undefined,
    },
    {
      id: 'canonical-url-parity',
      label: 'Canonical URL parity',
      severity: urlMismatches.length === 0 ? 'pass' : 'fail',
      message:
        urlMismatches.length === 0
          ? 'Product URLs match across agent and Google feed sources.'
          : `${urlMismatches.length} products have mismatched canonical URLs across feed sources.`,
      affectedProductIds: urlMismatches.length > 0 ? urlMismatches : undefined,
    },
    {
      id: 'price-parity',
      label: 'Price parity',
      severity: priceMismatches.length === 0 ? 'pass' : 'fail',
      message:
        priceMismatches.length === 0
          ? 'Base prices match across agent and Google feed sources.'
          : `${priceMismatches.length} products have mismatched base prices across feed sources.`,
      affectedProductIds:
        priceMismatches.length > 0 ? priceMismatches : undefined,
    },
    {
      id: 'verified-image-coverage',
      label: 'Verified image coverage',
      severity: getTrustCoverageSeverity(
        productsWithVerifiedImages,
        openAiFeedData.products.length
      ),
      message:
        openAiFeedData.products.length === 0
          ? 'No active products are available for image validation.'
          : `${productsWithVerifiedImages} of ${openAiFeedData.products.length} agent-visible products have verified feed images.`,
    },
    {
      id: 'policy-coverage',
      label: 'Policy coverage',
      severity:
        publishedPolicyLinksCount === requiredPolicyLinksCount
          ? 'pass'
          : 'warn',
      message:
        publishedPolicyLinksCount === requiredPolicyLinksCount
          ? 'Return, shipping, privacy, and terms policy links are published.'
          : `${publishedPolicyLinksCount} of ${requiredPolicyLinksCount} policy links are published (returns, shipping, privacy, terms).`,
    },
    {
      id: 'support-contact',
      label: 'Support contact',
      severity: hasSupportContact ? 'pass' : 'fail',
      message: hasSupportContact
        ? 'A support contact is available for post-purchase questions.'
        : 'Add support email, phone, or WhatsApp details.',
    },
    ...healthSignals.checks,
    {
      id: 'machine-endpoint-discovery',
      label: 'Machine endpoint discovery',
      severity: validSurfaceUrls === surfaceUrls.length ? 'pass' : 'fail',
      message:
        validSurfaceUrls === surfaceUrls.length
          ? 'Agent manifest, feeds, product API, and policy URLs are discoverable.'
          : 'One or more machine-readable endpoint URLs are malformed.',
    },
  ];
  const checks = checkCandidates.map(withTrustActionGuidance);

  return {
    checks,
    status: getStatus(checks),
    surfaces,
    totals: {
      googleProducts: googleFeedData.products.length,
      openAiProducts: openAiFeedData.products.length,
      sharedProducts: sharedProductIds.length,
      urlMismatches: urlMismatches.length,
      priceMismatches: priceMismatches.length,
      productsWithVerifiedImages,
      ...healthSignals.totals,
    },
  };
}
