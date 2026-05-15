import type { Route } from 'next';
import type {
  AgentCommerceTrustCheck,
  AgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';

export interface AgentCommerceTrustActionItem {
  count: number | null;
  href: Route;
  id: AgentCommerceTrustCheck['id'];
  label: string;
  message: string;
  severity: AgentCommerceTrustCheck['severity'];
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
  check: AgentCommerceTrustCheck,
  readiness: AgentCommerceTrustReadiness
): number | null {
  if (check.affectedProductIds?.length) {
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
  readiness: AgentCommerceTrustReadiness
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

export const agentCommerceTrustReadinessCardHelpers = {
  buildTrustActionItems,
};
