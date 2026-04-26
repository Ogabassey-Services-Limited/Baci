/**
 * Jumia Vendor Center API — Auth helpers
 *
 * Handles OAuth URL generation, code exchange, and environment config.
 * Matches Postman collection: GET {{baseUrl}}/login, POST {{baseUrl}}/token
 */

import { ZodError } from 'zod';
import { env as validatedEnv } from '@/env';
import type { JumiaTokenResponse } from '@/schemas/jumia';
import { JumiaTokenResponseSchema } from '@/schemas/jumia';

// ── Environment ──

export type JumiaEnvironment = 'staging' | 'production';

const BASE_URLS: Record<JumiaEnvironment, string> = {
  staging: 'https://vendor-api-staging.jumia.com',
  production: 'https://vendor-api.jumia.com',
};

export function getJumiaEnvironment(): JumiaEnvironment {
  return validatedEnv.JUMIA_ENVIRONMENT;
}

export function getJumiaBaseUrl(env?: JumiaEnvironment): string {
  return BASE_URLS[env ?? getJumiaEnvironment()];
}

// ── Token refresh buffer ──

export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ── OAuth: Authorization URL ──

export function getJumiaAuthUrl(config: {
  clientId: string;
  redirectUri: string;
  state: string;
  environment?: JumiaEnvironment;
}): string {
  const baseUrl = getJumiaBaseUrl(config.environment);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid',
    prompt: 'login',
    max_age: '0',
    state: config.state,
  });
  return `${baseUrl}/login?${params.toString()}`;
}

export function getJumiaRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/api/marketplace/jumia/callback`;
}

// ── OAuth: Code exchange ──

export class JumiaApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(`Jumia API Error (${status}): ${message}`);
    this.name = 'JumiaApiError';
  }
}

function redactJumiaErrorDetails(raw: string): string {
  return raw
    .replace(
      /"(access_token|refresh_token|client_secret|code)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"'
    )
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(^|[?&])(client_secret|code)=[^&\s"]*/gi, '$1$2=[REDACTED]');
}

function safeStringifyJumiaErrorDetails(details: unknown): string {
  if (typeof details === 'string') {
    return details;
  }

  const seen = new WeakSet<object>();

  try {
    const stringified = JSON.stringify(
      details,
      (_key, value: unknown) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        return value;
      },
      2
    );

    if (typeof stringified === 'string') {
      return stringified;
    }
  } catch {
    // Fall through to String(details)
  }

  return String(details);
}

export function sanitizeJumiaErrorDetails(
  details: unknown,
  maxLength = 1_000
): unknown {
  if (details == null) {
    return undefined;
  }

  const raw = safeStringifyJumiaErrorDetails(details);
  const redacted = redactJumiaErrorDetails(raw);

  if (redacted.length > maxLength) {
    return `${redacted.slice(0, maxLength)}...[truncated]`;
  }

  try {
    return JSON.parse(redacted) as unknown;
  } catch {
    return redacted;
  }
}

export async function exchangeJumiaCode(config: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: JumiaEnvironment;
}): Promise<JumiaTokenResponse> {
  const baseUrl = getJumiaBaseUrl(config.environment);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: config.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error');
      throw new JumiaApiError(response.status, 'Token exchange failed', body);
    }

    const data = JumiaTokenResponseSchema.parse(await response.json());
    if (!data.refresh_token) {
      throw new JumiaApiError(
        502,
        'Token exchange response did not include a refresh token'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof JumiaApiError) throw error;
    if (
      (error instanceof Error || error instanceof DOMException) &&
      error.name === 'AbortError'
    ) {
      throw new JumiaApiError(408, 'Token exchange request timed out');
    }
    if (error instanceof ZodError) {
      throw new JumiaApiError(502, 'Invalid token response from Jumia', error);
    }
    throw new JumiaApiError(500, 'Token exchange failed unexpectedly', error);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Shared API error response helper ──

/**
 * Converts a JumiaApiError into a JSON Response with the appropriate HTTP status.
 * Preserves meaningful Jumia API status codes (400-599), falls back to 500.
 */
export function jumiaErrorResponse(err: JumiaApiError): Response {
  const safeDetails = sanitizeJumiaErrorDetails(err.details);
  console.error('[Jumia API]', {
    message: err.message,
    details: safeDetails,
    stack: err.stack,
  });
  const status = err.status >= 400 && err.status < 600 ? err.status : 500;
  return Response.json({ error: 'Jumia API error' }, { status });
}
