import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  agenticCheckoutItemsSchema,
  agenticFulfillmentAddressSchema,
  createAgenticCheckoutSessionInputSchema,
} from '../src/schemas/agentic-checkout';

const agenticCheckoutSessionIdInputSchema = z.object({
  session_id: z.string().trim().min(1, 'Checkout session id is required'),
});
const agenticCheckoutIdempotencyInputSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(128).optional(),
});

export const getAgenticCheckoutSessionInputSchema =
  agenticCheckoutSessionIdInputSchema;
export const updateAgenticCheckoutSessionInputSchema =
  agenticCheckoutSessionIdInputSchema
    .merge(agenticCheckoutIdempotencyInputSchema)
    .extend({
      fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
      items: agenticCheckoutItemsSchema.optional(),
      shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
    })
    .refine(
      (value) =>
        value.items !== undefined ||
        value.shipping_address !== undefined ||
        value.fulfillment_option_id !== undefined,
      {
        message:
          'At least one of items, shipping_address, or fulfillment_option_id is required',
      }
    );
export const cancelAgenticCheckoutSessionInputSchema =
  agenticCheckoutSessionIdInputSchema.merge(
    agenticCheckoutIdempotencyInputSchema
  );

export {
  agenticCheckoutItemsSchema,
  agenticFulfillmentAddressSchema,
  createAgenticCheckoutSessionInputSchema,
};

export const AGENTIC_CHECKOUT_API_VERSION = '2026-04-30';
export const AGENTIC_CHECKOUT_USER_AGENT = 'OpenAI-Agent Baci-MCP/1.0';
const AGENTIC_CHECKOUT_PATH = '/api/agentic/checkout_sessions';

export type CreateAgenticCheckoutSessionInput = z.input<
  typeof createAgenticCheckoutSessionInputSchema
>;
export type GetAgenticCheckoutSessionInput = z.input<
  typeof getAgenticCheckoutSessionInputSchema
>;
export type UpdateAgenticCheckoutSessionInput = z.input<
  typeof updateAgenticCheckoutSessionInputSchema
>;
export type CancelAgenticCheckoutSessionInput = z.input<
  typeof cancelAgenticCheckoutSessionInputSchema
>;

export type AgenticCheckoutSessionRequestResult =
  | {
      endpoint: string;
      idempotencyKey?: string;
      ok: true;
      requestId: string;
      response: unknown;
      status: number;
    }
  | {
      details?: unknown;
      endpoint?: string;
      error: string;
      idempotencyKey?: string;
      ok: false;
      requestId?: string;
      status: number;
    };
export type CreateAgenticCheckoutSessionResult =
  AgenticCheckoutSessionRequestResult;

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
): Promise<AgenticCheckoutSessionRequestResult> {
  const parsed = createAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session input',
      ok: false,
      status: 400,
    };
  }

  const idempotencyKey =
    parsed.data.idempotency_key ?? `mcp_checkout_${randomUUID()}`;
  return sendAgenticCheckoutRequest({
    body: {
      currency: parsed.data.currency,
      items: parsed.data.items,
      ...(parsed.data.shipping_address !== undefined
        ? { shipping_address: parsed.data.shipping_address }
        : {}),
    },
    config,
    idempotencyKey,
    method: 'POST',
    pathname: AGENTIC_CHECKOUT_PATH,
  });
}

export async function getAgenticCheckoutSession(
  input: GetAgenticCheckoutSessionInput,
  config: AgenticCheckoutClientConfig
): Promise<AgenticCheckoutSessionRequestResult> {
  const parsed = getAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session input: session_id is required',
      ok: false,
      status: 400,
    };
  }

  return sendAgenticCheckoutRequest({
    config,
    method: 'GET',
    pathname: buildAgenticCheckoutSessionPath(parsed.data.session_id),
  });
}

export async function updateAgenticCheckoutSession(
  input: UpdateAgenticCheckoutSessionInput,
  config: AgenticCheckoutClientConfig
): Promise<AgenticCheckoutSessionRequestResult> {
  const parsed = updateAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session update input',
      ok: false,
      status: 400,
    };
  }

  const idempotencyKey =
    parsed.data.idempotency_key ?? `mcp_checkout_update_${randomUUID()}`;
  return sendAgenticCheckoutRequest({
    body: buildCheckoutSessionUpdateBody(parsed.data),
    config,
    idempotencyKey,
    method: 'POST',
    pathname: buildAgenticCheckoutSessionPath(parsed.data.session_id),
  });
}

export async function cancelAgenticCheckoutSession(
  input: CancelAgenticCheckoutSessionInput,
  config: AgenticCheckoutClientConfig
): Promise<AgenticCheckoutSessionRequestResult> {
  const parsed = cancelAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session cancel input: session_id is required',
      ok: false,
      status: 400,
    };
  }

  const idempotencyKey =
    parsed.data.idempotency_key ?? `mcp_checkout_cancel_${randomUUID()}`;
  return sendAgenticCheckoutRequest({
    config,
    idempotencyKey,
    method: 'POST',
    pathname: `${buildAgenticCheckoutSessionPath(parsed.data.session_id)}/cancel`,
  });
}

async function sendAgenticCheckoutRequest({
  body,
  config,
  idempotencyKey,
  method,
  pathname,
}: {
  body?: unknown;
  config: AgenticCheckoutClientConfig;
  idempotencyKey?: string;
  method: string;
  pathname: string;
}): Promise<AgenticCheckoutSessionRequestResult> {
  if (!config.apiKey || !config.signingKey) {
    return {
      error: 'Agentic checkout credentials are not configured',
      ok: false,
      status: 503,
    };
  }

  const endpoint = buildAgenticCheckoutUrl(config.apiBaseUrl, pathname);
  const requestId =
    config.requestIdFactory?.() ?? `mcp_checkout_${randomUUID()}`;
  const timestamp = (config.now?.() ?? new Date()).toISOString();
  const requestBody = body === undefined ? '' : JSON.stringify(body);
  const signature = signAgenticRequest({
    apiVersion: AGENTIC_CHECKOUT_API_VERSION,
    body: requestBody,
    idempotencyKey: idempotencyKey ?? '',
    method,
    pathname,
    requestId,
    signingKey: config.signingKey,
    timestamp,
  });
  const fetchImpl = config.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'api-version': AGENTIC_CHECKOUT_API_VERSION,
    authorization: `Bearer ${config.apiKey}`,
    'request-id': requestId,
    signature,
    timestamp,
    'user-agent': AGENTIC_CHECKOUT_USER_AGENT,
  };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  try {
    const requestInit: RequestInit = {
      headers,
      method,
    };
    if (body !== undefined) {
      requestInit.body = requestBody;
    }
    const response = await fetchImpl(endpoint, requestInit);
    const responseBody = await readJsonResponse(response);

    if (!response.ok) {
      return {
        details: responseBody,
        endpoint,
        error: readErrorMessage(responseBody),
        idempotencyKey,
        ok: false,
        requestId,
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
      idempotencyKey,
      ok: false,
      requestId,
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

function buildAgenticCheckoutUrl(apiBaseUrl: string, pathname: string) {
  return new URL(pathname, normalizeBaseUrl(apiBaseUrl)).toString();
}

function buildAgenticCheckoutSessionPath(sessionId: string) {
  return `${AGENTIC_CHECKOUT_PATH}/${encodeURIComponent(sessionId)}`;
}

function buildCheckoutSessionUpdateBody(
  input: z.infer<typeof updateAgenticCheckoutSessionInputSchema>
) {
  return {
    ...(input.items !== undefined ? { items: input.items } : {}),
    ...(input.shipping_address !== undefined
      ? { shipping_address: input.shipping_address }
      : {}),
    ...(input.fulfillment_option_id !== undefined
      ? { fulfillment_option_id: input.fulfillment_option_id }
      : {}),
  };
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
