import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { trimTrailingSlash } from '@/lib/storefront-agent-urls';
import type {
  AgentCommerceTrustReadiness,
  AgentCommerceTrustSeverity,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';

const AGENT_NATIVE_COMMERCE_PROOF_SCHEMA_VERSION = '2026-05-15';
const CHECKOUT_COMPLETE_CAPABILITY = 'checkout.session.complete';
const ORDER_READ_CAPABILITY = 'order.read';

type ProofStageId =
  | 'discoverable'
  | 'trusted'
  | 'purchasable'
  | 'recoverable'
  | 'manageable';

type ProofStatus = AgentCommerceTrustSeverity;

type ProofStage = {
  id: ProofStageId;
  evidence_url: string | null;
  label: string;
  message: string;
  status: ProofStatus;
  visibility: 'public' | 'merchant_authenticated';
};

type BuildAgentNativeCommerceProofInput = {
  baseUrl: string;
  manifest: AgentCommerceManifest;
  trustReadiness: AgentCommerceTrustReadiness;
};

function countTrustChecks(
  trustReadiness: AgentCommerceTrustReadiness
): Record<AgentCommerceTrustSeverity, number> {
  const counts: Record<AgentCommerceTrustSeverity, number> = {
    fail: 0,
    pass: 0,
    warn: 0,
  };

  for (const check of trustReadiness.checks) {
    counts[check.severity] += 1;
  }

  return counts;
}

function getOverallStatus(stages: ProofStage[]): ProofStatus {
  if (stages.some((stage) => stage.status === 'fail')) return 'fail';
  if (stages.some((stage) => stage.status === 'warn')) return 'warn';
  return 'pass';
}

function getTrustedStageMessage(status: AgentCommerceTrustSeverity): string {
  switch (status) {
    case 'pass':
      return 'Trust checks pass across catalog parity, policy coverage, images, freshness, and crawler-visible endpoints.';
    case 'warn':
      return 'Trust checks are mostly ready, with warnings that should be reviewed before broad promotion.';
    case 'fail':
      return 'One or more trust checks need merchant attention before agents should confidently recommend this store.';
  }
}

export function buildAgentNativeCommerceProof({
  baseUrl,
  manifest,
  trustReadiness,
}: BuildAgentNativeCommerceProofInput) {
  const root = trimTrailingSlash(baseUrl);
  const hasCatalogRead = manifest.capabilities.includes('catalog.read');
  const hasCheckoutComplete = manifest.capabilities.includes(
    CHECKOUT_COMPLETE_CAPABILITY
  );
  const hasOrderRead = manifest.capabilities.includes(ORDER_READ_CAPABILITY);
  const hasSignedAuth = manifest.auth?.type === 'bearer_hmac';
  const hasPaymentMethods = manifest.payment_methods.length > 0;
  const hasPurchaseFlow =
    hasCheckoutComplete && hasSignedAuth && hasPaymentMethods;
  const checkCounts = countTrustChecks(trustReadiness);

  const stages: ProofStage[] = [
    {
      id: 'discoverable',
      evidence_url: manifest.links.agent_native_commerce,
      label: 'Discoverable',
      message: hasCatalogRead
        ? 'The storefront publishes machine-readable commerce, trust, feed, and UCP discovery surfaces.'
        : 'Catalog discovery is not advertised for this storefront.',
      status: hasCatalogRead ? 'pass' : 'fail',
      visibility: 'public',
    },
    {
      id: 'trusted',
      evidence_url: manifest.links.trust,
      label: 'Trusted',
      message: getTrustedStageMessage(trustReadiness.status),
      status: trustReadiness.status,
      visibility: 'public',
    },
    {
      id: 'purchasable',
      evidence_url: hasPurchaseFlow
        ? (manifest.links.checkout_sessions ?? null)
        : null,
      label: 'Purchasable',
      message: hasPurchaseFlow
        ? 'Signed checkout sessions and configured payment methods are advertised for agent purchase flows.'
        : 'Checkout is discoverable only after signed auth and at least one merchant payment method are configured.',
      status: hasPurchaseFlow ? 'pass' : 'warn',
      visibility: 'public',
    },
    {
      id: 'recoverable',
      evidence_url: manifest.links.order ?? null,
      label: 'Recoverable',
      message: hasOrderRead
        ? 'Order reads and idempotent checkout states give agents a deterministic recovery path after retries.'
        : 'Order read recovery is not advertised for this storefront.',
      status: hasOrderRead ? 'pass' : 'warn',
      visibility: 'public',
    },
    {
      id: 'manageable',
      evidence_url: null,
      label: 'Manageable',
      message:
        'Merchant-authenticated dashboard surfaces expose agent action health without leaking private order or payment records.',
      status: 'pass',
      visibility: 'merchant_authenticated',
    },
  ];

  return {
    schema_version: AGENT_NATIVE_COMMERCE_PROOF_SCHEMA_VERSION,
    platform: 'baci',
    positioning: {
      category: 'agent-native commerce infrastructure',
      thesis:
        'Baci lets African merchants sell through AI agents while keeping their storefront, domain, payments, and customer relationship.',
      reference_merchant: manifest.store.slug,
    },
    store: manifest.store,
    proof: {
      status: getOverallStatus(stages),
      stages,
      action: {
        capabilities: manifest.capabilities,
        optional_identity_headers:
          manifest.auth?.request_signing?.optional_identity_headers ?? [],
        payment_methods: manifest.payment_methods,
        signed_requests: hasSignedAuth,
      },
      surfaces: {
        agent_commerce_manifest: `${root}${STOREFRONT_AGENT_ROUTES.manifest}`,
        agent_native_commerce: manifest.links.agent_native_commerce,
        agent_trust: manifest.links.trust,
        human_storefront: root,
        product_feed: manifest.links.product_feed,
        ucp_profile: `${root}${STOREFRONT_AGENT_ROUTES.ucpProfile}`,
      },
      trust: {
        status: trustReadiness.status,
        checks: {
          total: trustReadiness.checks.length,
          ...checkCounts,
        },
        totals: trustReadiness.totals,
      },
    },
  };
}
