import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const AGENTIC_CHECKOUT_API_VERSION = '2026-04-30';
const AGENTIC_CHECKOUT_PATH = '/api/agentic/checkout_sessions';

const fulfillmentAddressSchema = z.object({
  address: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(2).max(3).optional(),
  email: z.string().email().optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(7).optional(),
  postal_code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  station_id: z.number().int().nonnegative().optional(),
});

const checkoutItemSchema = z.object({
  id: z.string().trim().min(1),
  quantity: z.number().int().positive().max(20),
});

export const createAgenticCheckoutSessionInputSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional()
    .default('NGN'),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
  items: z.array(checkoutItemSchema).min(1).max(50),
  shipping_address: fulfillmentAddressSchema.nullable().optional(),
});

export type CreateAgenticCheckoutSessionInput = z.input<
  typeof createAgenticCheckoutSessionInputSchema
>;

export type CreateAgenticCheckoutSessionResult =
  | {
      endpoint: string;
      idempotencyKey: string;
      ok: true;
      requestId: string;
      response: unknown;
      status: number;
    }
  | {
      details?: unknown;
      endpoint?: string;
      error: string;
      ok: false;
      status: number;
    };

export type AgenticCheckoutClientConfig = {
  apiBaseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestIdFactory?: () => string;
  signingKey?: string;
};

export async function createAgenticCheckoutSession(
  input: CreateAgenticCheckoutSessionInput,
  config: AgenticCheckoutClientConfig
): Promise<CreateAgenticCheckoutSessionResult> {
  const parsed = createAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session input',
      ok: false,
      status: 400,
    };
  }

  if (!config.apiKey || !config.signingKey) {
    return {
      error: 'Agentic checkout credentials are not configured',
      ok: false,
      status: 503,
    };
  }

  const endpoint = buildAgenticCheckoutUrl(config.apiBaseUrl);
  const idempotencyKey =
    parsed.data.idempotency_key ?? `mcp_checkout_${randomUUID()}`;
  const requestId =
    config.requestIdFactory?.() ?? `mcp_checkout_${randomUUID()}`;
  const timestamp = (config.now?.() ?? new Date()).toISOString();
  const body = JSON.stringify({
    currency: parsed.data.currency,
    items: parsed.data.items,
    ...(parsed.data.shipping_address !== undefined
      ? { shipping_address: parsed.data.shipping_address }
      : {}),
  });
  const signature = signAgenticRequest({
    apiVersion: AGENTIC_CHECKOUT_API_VERSION,
    body,
    idempotencyKey,
    method: 'POST',
    pathname: AGENTIC_CHECKOUT_PATH,
    requestId,
    signingKey: config.signingKey,
    timestamp,
  });
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(endpoint, {
      body,
      headers: {
        'api-version': AGENTIC_CHECKOUT_API_VERSION,
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'request-id': requestId,
        signature,
        timestamp,
      },
      method: 'POST',
    });
    const responseBody = await readJsonResponse(response);

    if (!response.ok) {
      return {
        details: responseBody,
        endpoint,
        error: readErrorMessage(responseBody),
        ok: false,
        status: response.status,
      };
    }

    return {
      endpoint,
      idempotencyKey,
      ok: true,
      requestId,
      response: responseBody,
      status: response.status,
    };
  } catch (error) {
    return {
      endpoint,
      error: error instanceof Error ? error.message : 'Checkout request failed',
      ok: false,
      status: 502,
    };
  }
}

export function signAgenticRequest({
  apiVersion,
  body,
  idempotencyKey,
  method,
  pathname,
  requestId,
  signingKey,
  timestamp,
}: {
  apiVersion: string;
  body: string;
  idempotencyKey: string;
  method: string;
  pathname: string;
  requestId: string;
  signingKey: string;
  timestamp: string;
}) {
  return createHmac('sha256', signingKey)
    .update(
      JSON.stringify({
        api_version: apiVersion,
        body,
        idempotency_key: idempotencyKey,
        method: method.toUpperCase(),
        pathname,
        request_id: requestId,
        timestamp,
      })
    )
    .digest('hex');
}

function buildAgenticCheckoutUrl(apiBaseUrl: string) {
  return new URL(AGENTIC_CHECKOUT_PATH, normalizeBaseUrl(apiBaseUrl)).toString();
}

function normalizeBaseUrl(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function readErrorMessage(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'error' in responseBody &&
    typeof responseBody.error === 'string'
  ) {
    return responseBody.error;
  }

  return 'Agentic checkout request failed';
}
