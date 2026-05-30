import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  cancelAgenticCheckoutSessionInputSchema,
  agenticCheckoutItemsSchema,
  agenticCheckoutCompleteSchema,
  agenticFulfillmentAddressSchema,
  createAgenticCheckoutSessionInputSchema,
  getAgenticCheckoutSessionInputSchema,
  updateAgenticCheckoutSessionInputSchema,
} from '../src/schemas/agentic-checkout';

export {
  cancelAgenticCheckoutSessionInputSchema,
  agenticCheckoutItemsSchema,
  agenticFulfillmentAddressSchema,
  agenticCheckoutCompleteSchema,
  createAgenticCheckoutSessionInputSchema,
  getAgenticCheckoutSessionInputSchema,
  updateAgenticCheckoutSessionInputSchema,
};

export const AGENTIC_CHECKOUT_API_VERSION = '2026-04-30';
export const AGENTIC_CHECKOUT_AGENT_ID = 'openai:baci-mcp';
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

const createAgenticCheckoutSessionMcpItemSchema = z.object({
  id: z.string().trim().min(1, 'Item id is required'),
  quantity: z
    .number()
    .int()
    .positive('Quantity must be a positive integer')
    .max(20, 'Quantity must be 20 or less'),
});

export const createAgenticCheckoutSessionMcpInputSchema = {
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .optional()
    .default('NGN'),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
  items: z.array(createAgenticCheckoutSessionMcpItemSchema).min(1).max(50),
  shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const updateAgenticCheckoutSessionMcpInputSchema = {
  fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
  items: z
    .array(createAgenticCheckoutSessionMcpItemSchema)
    .min(1)
    .max(50)
    .optional(),
  session_id: z.string().trim().min(1, 'Checkout session id is required'),
  shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const completeAgenticCheckoutSessionInputSchema =
  agenticCheckoutCompleteSchema.extend({
    idempotency_key: z.string().trim().min(8).max(128).optional(),
    session_id: z.string().trim().min(1, 'Checkout session id is required'),
  });
export type CompleteAgenticCheckoutSessionInput = z.input<
  typeof completeAgenticCheckoutSessionInputSchema
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
  agentId?: string;
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
      error: 'Invalid checkout session cancel input',
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

export async function completeAgenticCheckoutSession(
  input: CompleteAgenticCheckoutSessionInput,
  config: AgenticCheckoutClientConfig
): Promise<AgenticCheckoutSessionRequestResult> {
  const parsed = completeAgenticCheckoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      details: parsed.error.flatten(),
      error: 'Invalid checkout session complete input',
      ok: false,
      status: 400,
    };
  }

  const idempotencyKey =
    parsed.data.idempotency_key ?? `mcp_checkout_complete_${randomUUID()}`;
  return sendAgenticCheckoutRequest({
    body: {
      buyer: parsed.data.buyer,
      ...(parsed.data.completion_authorization !== undefined
        ? { completion_authorization: parsed.data.completion_authorization }
        : {}),
      payment_data: parsed.data.payment_data,
    },
    config,
    idempotencyKey,
    method: 'POST',
    pathname: `${buildAgenticCheckoutSessionPath(parsed.data.session_id)}/complete`,
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

  let endpoint: string | undefined;
  let requestId: string | undefined;
  try {
    endpoint = buildAgenticCheckoutUrl(config.apiBaseUrl, pathname);
    requestId = config.requestIdFactory?.() ?? `mcp_checkout_${randomUUID()}`;
    const timestamp = (config.now?.() ?? new Date()).toISOString();
    const requestBody = body === undefined ? '' : JSON.stringify(body);
    const agentId = config.agentId?.trim() ?? '';
    const signature = signAgenticRequest({
      agentId,
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
    if (agentId) {
      headers['agent-id'] = agentId;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

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
  agentId,
  apiVersion,
  body,
  idempotencyKey,
  method,
  pathname,
  requestId,
  signingKey,
  timestamp,
}: {
  agentId?: string;
  apiVersion: string;
  body: string;
  idempotencyKey: string;
  method: string;
  pathname: string;
  requestId: string;
  signingKey: string;
  timestamp: string;
}) {
  const payload: Record<string, string> = {
    api_version: apiVersion,
    body,
    idempotency_key: idempotencyKey,
    method: method.toUpperCase(),
    pathname,
    request_id: requestId,
    timestamp,
  };
  const trimmedAgentId = agentId?.trim() ?? '';
  if (trimmedAgentId) {
    payload.agent_id = trimmedAgentId;
  }

  return createHmac('sha256', signingKey)
    .update(JSON.stringify(payload))
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
