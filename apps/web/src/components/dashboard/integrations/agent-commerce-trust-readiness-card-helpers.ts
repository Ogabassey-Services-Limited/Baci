import type { Route } from 'next';
import type {
  AgentCommerceTrustCheck,
  AgentCommerceTrustCheckSummary,
  AgentCommerceTrustReadiness,
  AgentCommerceTrustReadinessSummary,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';

/**
 * Structural readiness shape consumed by the trust action items: either the
 * full {@link AgentCommerceTrustReadiness} (API-fed card) or the slim
 * {@link AgentCommerceTrustReadinessSummary} (SSR dashboard card).
 */
type TrustActionReadiness =
  | AgentCommerceTrustReadiness
  | AgentCommerceTrustReadinessSummary;

export interface AgentCommerceTrustActionItem {
  count: number | null;
  href: Route;
  id: AgentCommerceTrustCheck['id'];
  label: string;
  message: string;
  severity: AgentCommerceTrustCheck['severity'];
}

export interface AgentCommerceMachineContractLink {
  description: string;
  href: string;
  id:
    | 'agent-native-commerce'
    | 'agent-commerce-manifest'
    | 'agent-trust'
    | 'ucp-profile';
  label: string;
}

const CHECK_ACTIONS: Record<
  AgentCommerceTrustCheck['id'],
  { href: Route; label: string; message: string }
> = {
  'catalog-surface-parity': {
    href: '/dashboard/products',
    label: 'Review catalog surfaces',
    message: 'Keep active products present in every agent and search feed.',
  },
  'canonical-url-parity': {
    href: '/dashboard/seo',
    label: 'Fix product URLs',
    message: 'Align canonical product URLs before agents recommend products.',
  },
  'price-parity': {
    href: '/dashboard/products',
    label: 'Review product prices',
    message: 'Make feed prices match the storefront checkout price.',
  },
  'verified-image-coverage': {
    href: '/dashboard/products',
    label: 'Verify product images',
    message: 'Add valid product images for agent and Merchant Center trust.',
  },
  'policy-coverage': {
    href: '/dashboard/settings/trust',
    label: 'Update policies',
    message: 'Publish complete return and shipping policies.',
  },
  'support-contact': {
    href: '/dashboard/settings/trust',
    label: 'Update support contact',
    message: 'Add support email, phone, or WhatsApp details.',
  },
  'structured-data-readiness': {
    href: '/dashboard/products',
    label: 'Review structured data',
    message: 'Complete product fields used by agent and JSON-LD surfaces.',
  },
  'review-signal-coverage': {
    href: '/dashboard/reviews',
    label: 'Strengthen review signals',
    message:
      'Publish valid product review counts and ratings for trust scoring.',
  },
  'merchant-review-authority': {
    href: '/dashboard/settings/trust#merchant-review-authority',
    label: 'Connect Google reviews',
    message:
      'Connect a Google Business Profile place ID for merchant-level review authority.',
  },
  'feed-freshness': {
    href: '/dashboard/products',
    label: 'Refresh catalog feed',
    message: 'Update stale products so agents see current catalog data.',
  },
  'crawler-visibility': {
    href: '/dashboard/seo',
    label: 'Review crawler access',
    message: 'Keep robots and sitemap entry points visible.',
  },
  'machine-endpoint-discovery': {
    href: '/dashboard/settings/trust',
    label: 'Review agent endpoints',
    message: 'Repair malformed agent manifest, feed, or policy URLs.',
  },
};

const SEVERITY_ORDER: Record<string, number> = {
  fail: 0,
  warn: 1,
  pass: 2,
};

function getSeverityRank(severity: string): number {
  return SEVERITY_ORDER[severity] ?? Number.MAX_SAFE_INTEGER;
}

function getActionCount(
  check: AgentCommerceTrustCheck | AgentCommerceTrustCheckSummary,
  readiness: TrustActionReadiness
): number | null {
  if ('affectedProductCount' in check && check.affectedProductCount) {
    return check.affectedProductCount;
  }
  if ('affectedProductIds' in check && check.affectedProductIds?.length) {
    return check.affectedProductIds.length;
  }

  switch (check.id) {
    case 'canonical-url-parity':
      return readiness.totals.urlMismatches;
    case 'feed-freshness':
      return readiness.totals.staleProducts;
    case 'price-parity':
      return readiness.totals.priceMismatches;
    case 'verified-image-coverage':
      return Math.max(
        0,
        readiness.totals.openAiProducts -
          readiness.totals.productsWithVerifiedImages
      );
    default:
      return null;
  }
}

function buildTrustActionItems(
  readiness: TrustActionReadiness
): AgentCommerceTrustActionItem[] {
  return readiness.checks
    .filter((check) => check.severity !== 'pass')
    .flatMap((check) => {
      const action = (
        CHECK_ACTIONS as Partial<
          Record<string, { href: Route; label: string; message: string }>
        >
      )[check.id];
      if (!action) return [];

      return {
        count: getActionCount(check, readiness),
        href: action.href,
        id: check.id,
        label: action.label,
        message: action.message,
        severity: check.severity,
      };
    })
    .sort((a, b) => getSeverityRank(a.severity) - getSeverityRank(b.severity));
}

function hasUsableHref(
  link: AgentCommerceMachineContractLink
): link is AgentCommerceMachineContractLink {
  return link.href.trim().length > 0;
}

function buildMachineContractLinks(
  readiness: AgentCommerceTrustReadiness
): AgentCommerceMachineContractLink[] {
  const surfaces = readiness.surfaces;
  const links: AgentCommerceMachineContractLink[] = [
    {
      description: 'Live proof agents and evaluators can inspect.',
      href: surfaces.agentNativeCommerce ?? '',
      id: 'agent-native-commerce',
      label: 'Agent proof',
    },
    {
      description: 'Capabilities, feeds, payments, and checkout links.',
      href: surfaces.agentCommerceManifest ?? '',
      id: 'agent-commerce-manifest',
      label: 'Commerce manifest',
    },
    {
      description: 'Catalog, policy, image, and crawler readiness.',
      href: surfaces.agentTrust ?? '',
      id: 'agent-trust',
      label: 'Trust signals',
    },
    {
      description: 'Emerging UCP discovery profile for agent clients.',
      href: surfaces.ucpProfile ?? '',
      id: 'ucp-profile',
      label: 'UCP profile',
    },
  ];

  return links.filter(hasUsableHref);
}

export const agentCommerceTrustReadinessCardHelpers = {
  buildMachineContractLinks,
  buildTrustActionItems,
};
