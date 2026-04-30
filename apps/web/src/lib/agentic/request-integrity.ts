import { createHmac } from 'node:crypto';
import { constantTimeEqual } from '@/lib/constant-time-equal';

export const AGENTIC_API_VERSION = '2026-04-30';
export const PREVIOUS_AGENTIC_API_VERSION = '2026-01-01';
export const SUPPORTED_AGENTIC_API_VERSIONS = [
  AGENTIC_API_VERSION,
  PREVIOUS_AGENTIC_API_VERSION,
] as const;

type AgenticApiVersion = (typeof SUPPORTED_AGENTIC_API_VERSIONS)[number];

const MAX_TIMESTAMP_SKEW_MS = 2 * 60 * 1000;
const MAX_REQUEST_ID_LENGTH = 255;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type RequestIntegrityResult =
  | { apiVersion: AgenticApiVersion; ok: true; requestId: string }
  | { error: string; ok: false };

export function verifyAgenticRequestIntegrity({
  body,
  headers,
  method = 'POST',
  now = new Date(),
  pathname = '',
  secrets,
}: {
  body: string;
  headers: Headers;
  method?: string;
  now?: Date;
  pathname?: string;
  secrets: string[];
}): RequestIntegrityResult {
  const requestId = headers.get('request-id')?.trim();
  const apiVersion = headers.get('api-version')?.trim();
  const idempotencyKey = headers.get('idempotency-key')?.trim() ?? '';
  const signature = headers.get('signature')?.trim();
  const timestamp = headers.get('timestamp')?.trim();

  if (secrets.length === 0) {
    return { error: 'Missing signing secret', ok: false };
  }
  if (!requestId) {
    return { error: 'Missing request id', ok: false };
  }
  if (requestId.length > MAX_REQUEST_ID_LENGTH) {
    return { error: 'Request ID too long', ok: false };
  }
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return { error: 'Invalid request ID format', ok: false };
  }
  if (!apiVersion) {
    return { error: 'Missing api version', ok: false };
  }
  if (
    !SUPPORTED_AGENTIC_API_VERSIONS.includes(apiVersion as AgenticApiVersion)
  ) {
    return { error: 'Unsupported api version', ok: false };
  }
  if (!signature) {
    return { error: 'Missing signature', ok: false };
  }
  if (!timestamp) {
    return { error: 'Missing timestamp', ok: false };
  }

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { error: 'Invalid timestamp', ok: false };
  }
  if (Math.abs(now.getTime() - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
    return { error: 'Stale timestamp', ok: false };
  }

  const payload = canonicalRequestSignaturePayload({
    apiVersion,
    body,
    idempotencyKey,
    method,
    pathname,
    requestId,
    timestamp,
  });
  let hasValidSignature = false;
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    hasValidSignature =
      constantTimeEqual(signature, expected) || hasValidSignature;
  }

  if (!hasValidSignature) {
    return { error: 'Invalid signature', ok: false };
  }

  return {
    apiVersion: apiVersion as AgenticApiVersion,
    ok: true,
    requestId,
  };
}

function canonicalRequestSignaturePayload({
  apiVersion,
  body,
  idempotencyKey,
  method,
  pathname,
  requestId,
  timestamp,
}: {
  apiVersion: string;
  body: string;
  idempotencyKey: string;
  method: string;
  pathname: string;
  requestId: string;
  timestamp: string;
}) {
  return JSON.stringify({
    api_version: apiVersion,
    body,
    idempotency_key: idempotencyKey,
    method: method.toUpperCase(),
    pathname,
    request_id: requestId,
    timestamp,
  });
}

export function getAgenticSigningSecrets() {
  return [
    process.env.OPENAI_AGENTIC_SIGNING_KEY,
    process.env.OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS,
  ].filter((value): value is string => Boolean(value));
}
