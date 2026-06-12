import {
  WEBMCP_DEFAULT_CATALOG_LIMIT,
  type WebMcpCatalogSearchInput,
  webMcpCatalogSearchInputJsonSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpStorePoliciesInputJsonSchema,
} from '@/schemas/webmcp-storefront-tools-contract';
import { fetchJson, fetchText } from './webmcp-storefront-tools-fetch';
import {
  isStorePoliciesInputValid,
  parseCatalogSearchInput,
  parseProductIdInput,
} from './webmcp-storefront-tools-parsers';
import type { JsonObject, WebMcpTool } from './webmcp-storefront-tools-types';

type StorefrontProductResponse = {
  products?: unknown[];
};

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

function buildProductsUrl(
  merchantId: string,
  input: WebMcpCatalogSearchInput
): string {
  const params = new URLSearchParams({
    compact: 'false',
    merchant_id: merchantId,
    limit: String(input.limit ?? WEBMCP_DEFAULT_CATALOG_LIMIT),
  });
  const { brand, category, query, sort } = input;

  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  if (sort) params.set('sort', sort);

  return `/api/storefront/products?${params.toString()}`;
}

export function buildStorefrontWebMcpTools({
  merchantId,
  merchantSlug,
  signal,
}: {
  merchantId: string;
  merchantSlug: string;
  signal: AbortSignal;
}): WebMcpTool[] {
  return [
    {
      name: 'search_catalog',
      description:
        'Search public storefront products by query, category, brand, price sort, and limit.',
      inputSchema: webMcpCatalogSearchInputJsonSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async (input) => {
        const result = await fetchJson<StorefrontProductResponse>(
          buildProductsUrl(merchantId, parseCatalogSearchInput(input)),
          signal
        );

        return result.ok
          ? result.data
          : { error: result.error, status: result.status };
      },
    },
    {
      name: 'get_product',
      description: 'Fetch one public storefront product by product ID.',
      inputSchema: webMcpProductLookupInputJsonSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async (input) => {
        const parsedInput = parseProductIdInput(input);
        if (!parsedInput.ok) {
          return {
            error: parsedInput.error,
            status: 400,
          };
        }

        const params = new URLSearchParams({
          compact: 'false',
          ids: parsedInput.productId,
          merchant_id: merchantId,
        });
        const body = await fetchJson<StorefrontProductResponse>(
          `/api/storefront/products?${params.toString()}`,
          signal
        );
        if (!body.ok) {
          return { error: body.error, status: body.status };
        }

        return {
          product: body.data.products?.[0] ?? null,
        };
      },
    },
    {
      name: 'get_store_policies',
      description:
        'Read public agent discovery, authentication, and store policy links for this storefront.',
      inputSchema: webMcpStorePoliciesInputJsonSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async (input) => {
        if (!isStorePoliciesInputValid(input)) {
          return { error: 'Invalid input', status: 400 };
        }

        const [authMarkdown, agentCommerceResult] = await Promise.all([
          fetchText('/auth.md', signal),
          fetchJson<JsonObject>('/agent-commerce.json', signal),
        ]);

        return {
          auth_markdown: authMarkdown,
          discovery: {
            agent_commerce: '/agent-commerce.json',
            auth_doc: '/auth.md',
            llms: '/llms.txt',
            llms_full: '/llms-full.txt',
            openapi: '/openapi.json',
          },
          merchant_slug: merchantSlug,
          agent_commerce: agentCommerceResult.ok
            ? agentCommerceResult.data
            : {
                error: agentCommerceResult.error,
                status: agentCommerceResult.status,
              },
        };
      },
    },
  ];
}
