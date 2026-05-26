import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AgenticCheckoutClientConfig } from './agentic-checkout-client';
import { sendAgenticUcpRequest } from './agentic-ucp-request';

const UCP_CATALOG_SEARCH_PATH = '/api/agentic/catalog/search';
const UCP_CATALOG_LOOKUP_PATH = '/api/agentic/catalog/lookup';
const UCP_CARTS_PATH = '/api/agentic/carts';

const ucpMcpItemSchema = z.object({
  id: z.string().trim().min(1, 'Item id is required'),
  quantity: z.number().int().positive().max(20),
});

export const searchUcpCatalogInputSchema = {
  cursor: z.string().trim().min(1).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().positive().max(50).optional().default(20),
  query: z.string().trim().min(1).optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const lookupUcpCatalogItemsInputSchema = {
  filters: z.record(z.string(), z.unknown()).optional(),
  ids: z.array(z.string().trim().min(1)).min(1).max(50),
} satisfies Record<string, z.ZodTypeAny>;

export const createUcpCartInputSchema = {
  buyer: z.record(z.string(), z.unknown()).optional(),
  currency: z.string().trim().length(3).optional().default('NGN'),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
  items: z.array(ucpMcpItemSchema).min(1).max(50),
  shipping_address: z.record(z.string(), z.unknown()).nullable().optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const getUcpCartInputSchema = {
  cart_id: z.string().trim().min(1, 'Cart id is required'),
} satisfies Record<string, z.ZodTypeAny>;

export const updateUcpCartInputSchema = {
  buyer: z.record(z.string(), z.unknown()).optional(),
  cart_id: z.string().trim().min(1, 'Cart id is required'),
  currency: z.string().trim().length(3).optional(),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
  items: z.array(ucpMcpItemSchema).min(1).max(50).optional(),
  shipping_address: z.record(z.string(), z.unknown()).nullable().optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const convertUcpCartToCheckoutInputSchema = {
  cart_id: z.string().trim().min(1, 'Cart id is required'),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const cancelUcpCartInputSchema = convertUcpCartToCheckoutInputSchema;

export function searchUcpCatalog(
  input: z.input<z.ZodObject<typeof searchUcpCatalogInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  const body = {
    ...(input.filters ? { filters: input.filters } : {}),
    pagination: {
      ...(input.cursor ? { cursor: input.cursor } : {}),
      limit: input.limit ?? 20,
    },
    ...(input.query ? { query: input.query } : {}),
  };
  return sendAgenticUcpRequest({
    body,
    config,
    method: 'POST',
    pathname: UCP_CATALOG_SEARCH_PATH,
  });
}

export function lookupUcpCatalogItems(
  input: z.input<z.ZodObject<typeof lookupUcpCatalogItemsInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  return sendAgenticUcpRequest({
    body: input,
    config,
    method: 'POST',
    pathname: UCP_CATALOG_LOOKUP_PATH,
  });
}

export function createUcpCart(
  input: z.input<z.ZodObject<typeof createUcpCartInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  const idempotencyKey = input.idempotency_key ?? `mcp_ucp_cart_${randomUUID()}`;
  return sendAgenticUcpRequest({
    body: buildCartBody({ ...input, currency: input.currency ?? 'NGN' }),
    config,
    idempotencyKey,
    method: 'POST',
    pathname: UCP_CARTS_PATH,
  });
}

export function getUcpCart(
  input: z.input<z.ZodObject<typeof getUcpCartInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  return sendAgenticUcpRequest({
    config,
    method: 'GET',
    pathname: buildCartPath(input.cart_id),
  });
}

export function updateUcpCart(
  input: z.input<z.ZodObject<typeof updateUcpCartInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  const idempotencyKey =
    input.idempotency_key ?? `mcp_ucp_cart_update_${randomUUID()}`;
  return sendAgenticUcpRequest({
    body: buildCartBody(input),
    config,
    idempotencyKey,
    method: 'POST',
    pathname: buildCartPath(input.cart_id),
  });
}

export function convertUcpCartToCheckout(
  input: z.input<z.ZodObject<typeof convertUcpCartToCheckoutInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  const idempotencyKey =
    input.idempotency_key ?? `mcp_ucp_cart_checkout_${randomUUID()}`;
  return sendAgenticUcpRequest({
    body: {},
    config,
    idempotencyKey,
    method: 'POST',
    pathname: `${buildCartPath(input.cart_id)}/checkout`,
  });
}

export function cancelUcpCart(
  input: z.input<z.ZodObject<typeof cancelUcpCartInputSchema>>,
  config: AgenticCheckoutClientConfig
) {
  const idempotencyKey =
    input.idempotency_key ?? `mcp_ucp_cart_cancel_${randomUUID()}`;
  return sendAgenticUcpRequest({
    body: {},
    config,
    idempotencyKey,
    method: 'POST',
    pathname: `${buildCartPath(input.cart_id)}/cancel`,
  });
}

function buildCartBody(input: {
  buyer?: Record<string, unknown>;
  currency?: string;
  items?: Array<{ id: string; quantity: number }>;
  shipping_address?: Record<string, unknown> | null;
}) {
  const lineItems = input.items?.map((item) => ({
    item: { id: item.id },
    quantity: item.quantity,
  }));

  return {
    ...(input.buyer !== undefined ? { buyer: input.buyer } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(lineItems ? { line_items: lineItems } : {}),
    ...(input.shipping_address !== undefined
      ? { shipping_address: input.shipping_address }
      : {}),
    };
}

function buildCartPath(cartId: string) {
  return `${UCP_CARTS_PATH}/${encodeURIComponent(cartId)}`;
}
