import { z } from 'zod';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { AGENT_COMMERCE_SCHEMA_VERSION } from '@/lib/agentic/agent-commerce-manifest';
import { buildStoreUrl } from '@/lib/store-url';

const MANIFEST_FETCH_TIMEOUT_MS = 5_000;
const CHECKOUT_CAPABILITIES = [
  'checkout.session.create',
  'checkout.session.read',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
] as const;

const CHECKOUT_LINK_KEYS = [
  'checkout_session',
  'checkout_session_cancel',
  'checkout_session_complete',
  'checkout_sessions',
] as const;

const REQUIRED_LINK_KEYS = [
  'agent_native_commerce',
  'product_api',
  'product_feed',
  'trust',
] as const;

type AgentCommerceManifestHealthStatus = 'attention' | 'ok';

export interface AgentCommerceManifestHealthIssue {
  code:
    | 'manifest_contract_drift'
    | 'manifest_invalid_json'
    | 'manifest_unavailable';
  message: string;
}

export interface AgentCommerceManifestHealthResult {
  issue_count: number;
  issues: AgentCommerceManifestHealthIssue[];
  status: AgentCommerceManifestHealthStatus;
  url: string;
}

interface ManifestHealthMerchant {
  custom_domain?: string | null;
  slug: string;
}

const recordSchema = z.object({}).passthrough();
const stringArraySchema = z.array(z.string());

function getRecord(value: unknown): Record<string, unknown> | null {
  const parsed = recordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getStringArray(value: unknown): string[] | null {
  const parsed = stringArraySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function hasNonEmptyString(
  record: Record<string, unknown>,
  key: string
): boolean {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function createContractIssue(
  message: string
): AgentCommerceManifestHealthIssue {
  return {
    code: 'manifest_contract_drift',
    message,
  };
}

function buildAgentCommerceManifestHealthTarget(
  merchant: ManifestHealthMerchant
): { baseUrl: string; url: string } {
  const baseUrl = buildStoreUrl({
    custom_domain: merchant.custom_domain ?? undefined,
    slug: merchant.slug,
  });
  return {
    baseUrl,
    url: new URL(STOREFRONT_AGENT_ROUTES.manifest, baseUrl).toString(),
  };
}

export function buildAgentCommerceManifestHealthUrl(
  merchant: ManifestHealthMerchant
): string {
  return buildAgentCommerceManifestHealthTarget(merchant).url;
}

export function validateAgentCommerceManifestHealth({
  expectedOrigin,
  expectedSlug,
  manifest,
  url,
}: {
  expectedOrigin: string;
  expectedSlug: string;
  manifest: unknown;
  url: string;
}): AgentCommerceManifestHealthResult {
  const issues: AgentCommerceManifestHealthIssue[] = [];
  const manifestRecord = getRecord(manifest);

  if (!manifestRecord) {
    issues.push(
      createContractIssue('Manifest response must be a JSON object.')
    );
    return {
      issue_count: issues.length,
      issues,
      status: 'attention',
      url,
    };
  }

  if (manifestRecord.schema_version !== AGENT_COMMERCE_SCHEMA_VERSION) {
    issues.push(
      createContractIssue('Manifest schema version does not match runtime.')
    );
  }

  const store = getRecord(manifestRecord.store);
  if (!store) {
    issues.push(createContractIssue('Manifest store metadata is missing.'));
  } else {
    if (store.slug !== expectedSlug) {
      issues.push(createContractIssue('Manifest store slug is not scoped.'));
    }
    if (store.canonical_origin !== expectedOrigin) {
      issues.push(
        createContractIssue('Manifest canonical origin does not match URL.')
      );
    }
  }

  const links = getRecord(manifestRecord.links);
  if (!links) {
    issues.push(createContractIssue('Manifest links object is missing.'));
  } else {
    for (const key of REQUIRED_LINK_KEYS) {
      if (!hasNonEmptyString(links, key)) {
        issues.push(createContractIssue(`Manifest link ${key} is missing.`));
      }
    }
  }

  const capabilities = getStringArray(manifestRecord.capabilities);
  if (!capabilities) {
    issues.push(createContractIssue('Manifest capabilities must be strings.'));
  } else {
    if (!capabilities.includes('catalog.read')) {
      issues.push(createContractIssue('Manifest must advertise catalog.read.'));
    }

    const advertisedCheckoutCapabilities = CHECKOUT_CAPABILITIES.filter(
      (capability) => capabilities.includes(capability)
    );

    if (
      advertisedCheckoutCapabilities.length > 0 &&
      advertisedCheckoutCapabilities.length < CHECKOUT_CAPABILITIES.length
    ) {
      issues.push(
        createContractIssue(
          'Manifest advertises a partial checkout capability set.'
        )
      );
    }

    if (
      advertisedCheckoutCapabilities.length === CHECKOUT_CAPABILITIES.length
    ) {
      if (!getRecord(manifestRecord.auth)) {
        issues.push(
          createContractIssue('Checkout capabilities require manifest auth.')
        );
      }

      const paymentMethods = getStringArray(manifestRecord.payment_methods);
      if (!paymentMethods || paymentMethods.length === 0) {
        issues.push(
          createContractIssue('Checkout capabilities require a payment method.')
        );
      }

      if (links) {
        for (const key of CHECKOUT_LINK_KEYS) {
          if (!hasNonEmptyString(links, key)) {
            issues.push(
              createContractIssue(`Checkout link ${key} is missing.`)
            );
          }
        }
      }
    }

    if (capabilities.includes('order.read')) {
      if (!getRecord(manifestRecord.auth)) {
        issues.push(createContractIssue('Order read requires manifest auth.'));
      }
      if (links && !hasNonEmptyString(links, 'order')) {
        issues.push(createContractIssue('Order read link is missing.'));
      }
    }
  }

  return {
    issue_count: issues.length,
    issues,
    status: issues.length > 0 ? 'attention' : 'ok',
    url,
  };
}

export async function checkAgentCommerceManifestHealth(
  merchant: ManifestHealthMerchant,
  fetcher: typeof fetch = fetch
): Promise<AgentCommerceManifestHealthResult> {
  const { baseUrl, url } = buildAgentCommerceManifestHealthTarget(merchant);

  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        issue_count: 1,
        issues: [
          {
            code: 'manifest_unavailable',
            message: `Manifest returned HTTP ${response.status}.`,
          },
        ],
        status: 'attention',
        url,
      };
    }

    let manifest: unknown;
    try {
      manifest = await response.json();
    } catch (_error) {
      return {
        issue_count: 1,
        issues: [
          {
            code: 'manifest_invalid_json',
            message: 'Manifest response is not valid JSON.',
          },
        ],
        status: 'attention',
        url,
      };
    }

    return validateAgentCommerceManifestHealth({
      expectedOrigin: baseUrl,
      expectedSlug: merchant.slug,
      manifest,
      url,
    });
  } catch (_error) {
    return {
      issue_count: 1,
      issues: [
        {
          code: 'manifest_unavailable',
          message: 'Manifest could not be fetched.',
        },
      ],
      status: 'attention',
      url,
    };
  }
}
