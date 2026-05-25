import { buildStoreUrl } from '@/lib/store-url';
import type { AgenticAction } from '@/schemas/agentic-action-health';
import {
  comparePublicProductParitySurfaces,
  type PublicProductParityField,
  parseCurrentAgentProductSampleStream,
  parseGoogleMerchantProductSample,
  parsePdpProductSample,
  selectPublicProductApiSample,
} from './agent-commerce-public-product-parity-contract';
import { fetchPublicProductParityResponse } from './agent-commerce-public-product-parity-fetch';

type AgentCommercePublicProductParityStatus = 'attention' | 'monitor' | 'ok';
export type AgentCommercePublicProductParityIssueCode =
  | 'parity_contract_drift'
  | 'parity_sample_unavailable'
  | 'parity_surface_mismatch'
  | 'parity_surface_unavailable';
export interface AgentCommercePublicProductParityIssue {
  code: AgentCommercePublicProductParityIssueCode;
  count: number;
  fields?: PublicProductParityField[];
  message: string;
  severity: Exclude<AgenticAction['severity'], 'ok'>;
}
interface AgentCommercePublicProductParitySurfaces {
  agent_products: string;
  google_merchant_xml: string;
  product_api: string;
  product_page?: string;
}
export interface AgentCommercePublicProductParityResult {
  issue_count: number;
  issues: AgentCommercePublicProductParityIssue[];
  sample_product_id: string | null;
  status: AgentCommercePublicProductParityStatus;
  surfaces: AgentCommercePublicProductParitySurfaces;
}
interface ParityMerchant {
  custom_domain?: string | null;
  slug: string;
}
function buildParitySurfaces(merchant: ParityMerchant) {
  const baseUrl = buildStoreUrl({
    custom_domain: merchant.custom_domain ?? undefined,
    slug: merchant.slug,
  });
  const surfaces: AgentCommercePublicProductParitySurfaces = {
    agent_products: `${baseUrl}/feeds/agent-products.jsonl`,
    google_merchant_xml: `${baseUrl}/feeds/google-merchant.xml`,
    product_api: `${baseUrl}/api/storefront/${encodeURIComponent(merchant.slug)}/products?limit=10`,
  };
  return { baseUrl, surfaces };
}
function createResult({
  issue,
  sampleProductId,
  surfaces,
}: {
  issue?: AgentCommercePublicProductParityIssue;
  sampleProductId: string | null;
  surfaces: AgentCommercePublicProductParitySurfaces;
}): AgentCommercePublicProductParityResult {
  const issues = issue ? [issue] : [];
  return {
    issue_count: issues.length,
    issues,
    sample_product_id: sampleProductId,
    status: issue?.severity ?? 'ok',
    surfaces,
  };
}
function unavailableIssue(
  message: string
): AgentCommercePublicProductParityIssue {
  return {
    code: 'parity_surface_unavailable',
    count: 1,
    message,
    severity: 'attention',
  };
}
function contractIssue(message: string): AgentCommercePublicProductParityIssue {
  return {
    code: 'parity_contract_drift',
    count: 1,
    message,
    severity: 'attention',
  };
}
export async function checkAgentCommercePublicProductParity(
  merchant: ParityMerchant,
  fetcher: typeof fetch = fetch
): Promise<AgentCommercePublicProductParityResult> {
  const { baseUrl, surfaces } = buildParitySurfaces(merchant);
  const expectedOrigin = new URL(baseUrl).origin;
  const fetchSurface = (url: string, accept: string) =>
    fetchPublicProductParityResponse(fetcher, url, { accept, expectedOrigin });
  const apiResponse = await fetchSurface(
    surfaces.product_api,
    'application/json'
  );
  if (!apiResponse) {
    return createResult({
      issue: unavailableIssue('The public product API could not be loaded.'),
      sampleProductId: null,
      surfaces,
    });
  }
  let selection: ReturnType<typeof selectPublicProductApiSample>;
  try {
    selection = selectPublicProductApiSample(await apiResponse.json());
  } catch (_error) {
    selection = { kind: 'invalid' };
  }
  if (selection.kind === 'invalid') {
    return createResult({
      issue: contractIssue(
        'The public product API response contract has drifted.'
      ),
      sampleProductId: null,
      surfaces,
    });
  }
  if (selection.kind === 'empty') {
    return createResult({ sampleProductId: null, surfaces });
  }
  if (selection.kind === 'unsupported') {
    return createResult({
      issue: {
        code: 'parity_sample_unavailable',
        count: 1,
        message: 'No comparable simple product is available in the API sample.',
        severity: 'monitor',
      },
      sampleProductId: null,
      surfaces,
    });
  }
  const productId = selection.product.id;
  const [currentResponse, googleResponse] = await Promise.all([
    fetchSurface(surfaces.agent_products, 'application/jsonl'),
    fetchSurface(surfaces.google_merchant_xml, 'application/xml'),
  ]);
  if (!currentResponse || !googleResponse) {
    return createResult({
      issue: unavailableIssue('A public product feed could not be loaded.'),
      sampleProductId: productId,
      surfaces,
    });
  }
  const [current, google] = await Promise.all([
    parseCurrentAgentProductSampleStream(currentResponse.body, productId).catch(
      () => null
    ),
    googleResponse
      .text()
      .then((body) => parseGoogleMerchantProductSample(body, productId))
      .catch(() => null),
  ]);
  if (!current || !google) {
    return createResult({
      issue: contractIssue(
        'A public product feed does not expose the selected API sample.'
      ),
      sampleProductId: productId,
      surfaces,
    });
  }
  try {
    if (new URL(current.url).origin !== expectedOrigin) {
      throw new Error('Product URL origin does not match storefront origin.');
    }
  } catch (_error) {
    return createResult({
      issue: contractIssue(
        'The agent feed product URL is outside the store origin.'
      ),
      sampleProductId: productId,
      surfaces,
    });
  }
  const productSurfaces = { ...surfaces, product_page: current.url };
  const pageResponse = await fetchSurface(current.url, 'text/html');
  if (!pageResponse) {
    return createResult({
      issue: unavailableIssue(
        'The sampled public product page could not be loaded.'
      ),
      sampleProductId: productId,
      surfaces: productSurfaces,
    });
  }
  let pdp = null;
  try {
    pdp = parsePdpProductSample(await pageResponse.text());
  } catch (_error) {
    pdp = null;
  }
  if (!pdp) {
    return createResult({
      issue: contractIssue(
        'The sampled product page does not expose comparable Product JSON-LD.'
      ),
      sampleProductId: productId,
      surfaces: productSurfaces,
    });
  }
  const fields = comparePublicProductParitySurfaces({
    api: selection.product,
    current,
    google,
    pdp,
  });
  return createResult({
    issue:
      fields.length > 0
        ? {
            code: 'parity_surface_mismatch',
            count: fields.length,
            fields,
            message:
              'Public product fields do not match across catalog surfaces.',
            severity: 'attention',
          }
        : undefined,
    sampleProductId: productId,
    surfaces: productSurfaces,
  });
}
function getParityActionCode(parity: AgentCommercePublicProductParityResult) {
  return parity.issues.some((issue) => issue.code === 'parity_surface_mismatch')
    ? 'AGENT_COMMERCE_PUBLIC_PRODUCT_PARITY_FAILED'
    : parity.issues.some((issue) => issue.code === 'parity_sample_unavailable')
      ? 'AGENT_COMMERCE_PUBLIC_PRODUCT_PARITY_SAMPLE_SKIPPED'
      : 'AGENT_COMMERCE_PUBLIC_PRODUCT_PARITY_UNAVAILABLE';
}
export function buildAgentCommercePublicProductParityActions(
  parity: AgentCommercePublicProductParityResult
): AgenticAction[] {
  if (parity.status === 'ok') return [];
  const code = getParityActionCode(parity);
  return [
    {
      code,
      count: Math.max(
        1,
        parity.issues.reduce((total, issue) => total + issue.count, 0)
      ),
      message:
        parity.status === 'monitor'
          ? 'A comparable public product parity sample is not available.'
          : 'Public product catalog surfaces are not in parity.',
      next_step:
        'Open Agentic Commerce and resolve public product parity before expanding agent traffic.',
      next_step_url: '/dashboard/agentic',
      severity: parity.status === 'attention' ? 'attention' : 'monitor',
    },
  ];
}
export function getAgentCommercePublicProductParityStatusReason(
  parity: AgentCommercePublicProductParityResult,
  fallbackReason: string
) {
  if (parity.status === 'ok') return fallbackReason;
  if (
    parity.status === 'monitor' &&
    fallbackReason !== 'agentic_action_health_ok' &&
    fallbackReason !== 'agentic_action_health_monitor'
  ) {
    return fallbackReason;
  }
  return getParityActionCode(parity).toLowerCase();
}
