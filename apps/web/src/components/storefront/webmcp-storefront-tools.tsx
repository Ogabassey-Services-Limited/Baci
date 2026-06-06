'use client';

import { useEffect } from 'react';

type JsonObject = Record<string, unknown>;

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: true;
  };
  execute: (input: unknown) => Promise<unknown>;
};

type WebMcpModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void;
};

type DocumentWithModelContext = Document & {
  modelContext?: WebMcpModelContext;
};

type NavigatorWithModelContext = Navigator & {
  modelContext?: WebMcpModelContext;
};

type StorefrontProductResponse = {
  products?: unknown[];
};

const MAX_CATALOG_LIMIT = 50;

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

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

function getModelContext(): WebMcpModelContext | null {
  const currentDocument = document as DocumentWithModelContext;
  if (currentDocument.modelContext?.registerTool) {
    return currentDocument.modelContext;
  }

  const currentNavigator = navigator as NavigatorWithModelContext;
  return currentNavigator.modelContext?.registerTool
    ? currentNavigator.modelContext
    : null;
}

function getString(input: JsonObject, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPositiveInteger(
  input: JsonObject,
  key: string,
  fallback: number
): number {
  const value = input[key];
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_CATALOG_LIMIT)
    : fallback;
}

function asJsonObject(input: unknown): JsonObject {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as JsonObject)
    : {};
}

function buildProductsUrl(merchantId: string, input: JsonObject): string {
  const params = new URLSearchParams({
    compact: 'false',
    merchant_id: merchantId,
    limit: String(getPositiveInteger(input, 'limit', 10)),
  });
  const query = getString(input, 'query');
  const category = getString(input, 'category');
  const brand = getString(input, 'brand');
  const sort = getString(input, 'sort');

  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  if (sort && ['newest', 'price-asc', 'price-desc'].includes(sort)) {
    params.set('sort', sort);
  }

  return `/api/storefront/products?${params.toString()}`;
}

async function fetchJson<T>(url: string): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
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

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' },
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
}: {
  merchantId: string;
  merchantSlug: string;
}): WebMcpTool[] {
  return [
    {
      name: 'search_catalog',
      description:
        'Search public storefront products by query, category, brand, price sort, and limit.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string' },
          sort: {
            type: 'string',
            enum: ['newest', 'price-asc', 'price-desc'],
          },
          limit: { type: 'integer', minimum: 1, maximum: MAX_CATALOG_LIMIT },
        },
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async (input) => {
        const result = await fetchJson<StorefrontProductResponse>(
          buildProductsUrl(merchantId, asJsonObject(input))
        );

        return result.ok
          ? result.data
          : { error: result.error, status: result.status };
      },
    },
    {
      name: 'get_product',
      description: 'Fetch one public storefront product by product ID.',
      inputSchema: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
        },
        required: ['product_id'],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async (input) => {
        const productId = getString(asJsonObject(input), 'product_id');
        if (!productId) {
          return { error: 'product_id is required', status: 400 };
        }

        const params = new URLSearchParams({
          compact: 'false',
          ids: productId,
          merchant_id: merchantId,
        });
        const body = await fetchJson<StorefrontProductResponse>(
          `/api/storefront/products?${params.toString()}`
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
      inputSchema: {
        type: 'object',
        properties: {},
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: async () => {
        const [authMarkdown, agentCommerceResult] = await Promise.all([
          fetchText('/auth.md'),
          fetchJson<JsonObject>('/agent-commerce.json'),
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

export function WebMcpStorefrontTools({
  merchantId,
  merchantSlug,
}: {
  merchantId: string;
  merchantSlug: string;
}) {
  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) {
      return;
    }

    const controller = new AbortController();
    const tools = buildStorefrontWebMcpTools({ merchantId, merchantSlug });
    for (const tool of tools) {
      modelContext.registerTool(tool, { signal: controller.signal });
    }

    return () => controller.abort();
  }, [merchantId, merchantSlug]);

  return null;
}
