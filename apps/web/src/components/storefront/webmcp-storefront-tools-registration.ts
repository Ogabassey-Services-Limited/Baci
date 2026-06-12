import {
  WEBMCP_CATALOG_LIMIT,
  WEBMCP_CATALOG_SORT_VALUES,
  WEBMCP_DEFAULT_CATALOG_LIMIT,
  type WebMcpCatalogSearchInput,
  type WebMcpCatalogSort,
  webMcpCatalogSearchInputJsonSchema,
  webMcpProductLookupInputJsonSchema,
  webMcpStorePoliciesInputJsonSchema,
} from '@/schemas/webmcp-storefront-tools-contract';

type JsonObject = Record<string, unknown>;

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: true;
  };
  execute: (input: unknown) => Promise<unknown>;
};

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => Promise<undefined> | undefined;
};

type StorefrontProductResponse = {
  products?: unknown[];
};

type JsonResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

interface RegisterWebMcpStorefrontToolsOptions {
  merchantId: string;
  merchantSlug: string;
  modelContext: WebMcpModelContext;
  signal: AbortSignal;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isCatalogSort(value: unknown): value is WebMcpCatalogSort {
  return (
    typeof value === 'string' &&
    WEBMCP_CATALOG_SORT_VALUES.includes(value as WebMcpCatalogSort)
  );
}

function normalizeCatalogLimit(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= WEBMCP_CATALOG_LIMIT
    ? value
    : undefined;
}

export function parseCatalogSearchInput(
  input: unknown
): WebMcpCatalogSearchInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const record = input as Record<string, unknown>;
  return {
    brand: normalizeOptionalString(record.brand),
    category: normalizeOptionalString(record.category),
    limit: normalizeCatalogLimit(record.limit),
    query: normalizeOptionalString(record.query),
    sort: isCatalogSort(record.sort) ? record.sort : undefined,
  };
}

function parseProductIdInput(input: unknown):
  | {
      ok: true;
      productId: string;
    }
  | {
      ok: false;
      error: string;
    } {
  const hasProductId =
    input !== null && typeof input === 'object' && 'product_id' in input;

  if (!hasProductId) {
    return { ok: false, error: 'product_id is required' };
  }

  const productId = normalizeOptionalString(
    (input as Record<string, unknown>).product_id
  );
  return productId
    ? { ok: true, productId }
    : { ok: false, error: 'Invalid product_id' };
}

function isStorePoliciesInputValid(input: unknown): boolean {
  return (
    input === undefined ||
    (input !== null && typeof input === 'object' && !Array.isArray(input))
  );
}

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

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal
): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
      status: 0,
    };
  }
}

async function fetchText(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' },
      signal,
    });

    return response.ok ? response.text() : null;
  } catch (error) {
    console.warn('[WebMCP] Failed to fetch text document', { url, error });
    return null;
  }
}

function buildStorefrontWebMcpTools({
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

function logToolRegistrationError(error: unknown, toolName: string): void {
  console.warn('[WebMCP] Failed to register storefront tool', {
    error,
    tool: toolName,
  });
}

export function registerWebMcpStorefrontTools({
  merchantId,
  merchantSlug,
  modelContext,
  signal,
}: RegisterWebMcpStorefrontToolsOptions): void {
  const tools = buildStorefrontWebMcpTools({
    merchantId,
    merchantSlug,
    signal,
  });
  for (const tool of tools) {
    try {
      const registration = modelContext.registerTool(tool, { signal });
      if (registration) {
        void registration.catch((error: unknown) => {
          logToolRegistrationError(error, tool.name);
        });
      }
    } catch (error) {
      logToolRegistrationError(error, tool.name);
    }
  }
}
