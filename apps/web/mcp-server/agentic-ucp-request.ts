import { randomUUID } from 'node:crypto';
import {
  AGENTIC_CHECKOUT_AGENT_ID,
  AGENTIC_CHECKOUT_API_VERSION,
  AGENTIC_CHECKOUT_USER_AGENT,
  type AgenticCheckoutClientConfig,
  signAgenticRequest,
} from './agentic-checkout-client';

export type AgenticUcpRequestResult =
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

export async function sendAgenticUcpRequest({
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
}): Promise<AgenticUcpRequestResult> {
  if (!config.apiKey || !config.signingKey) {
    return {
      error: 'Agentic UCP credentials are not configured',
      ok: false,
      status: 503,
    };
  }

  let endpoint: string | undefined;
  let requestId: string | undefined;
  try {
    endpoint = new URL(pathname, normalizeBaseUrl(config.apiBaseUrl)).toString();
    requestId = config.requestIdFactory?.() ?? `mcp_ucp_${randomUUID()}`;
    const timestamp = (config.now?.() ?? new Date()).toISOString();
    const requestBody = body === undefined ? '' : JSON.stringify(body);
    const agentId = config.agentId?.trim() || AGENTIC_CHECKOUT_AGENT_ID;
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
    const headers: Record<string, string> = {
      'agent-id': agentId,
      'api-version': AGENTIC_CHECKOUT_API_VERSION,
      authorization: `Bearer ${config.apiKey}`,
      'request-id': requestId,
      signature,
      timestamp,
      'user-agent': AGENTIC_CHECKOUT_USER_AGENT,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

    const response = await (config.fetchImpl ?? fetch)(endpoint, {
      body: body === undefined ? undefined : requestBody,
      headers,
      method,
    });
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
      error: error instanceof Error ? error.message : 'UCP request failed',
      idempotencyKey,
      ok: false,
      requestId,
      status: 502,
    };
  }
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
  return 'Agentic UCP request failed';
}
