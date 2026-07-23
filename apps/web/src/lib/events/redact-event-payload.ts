import { sanitizeEventUrl } from './sanitize-event-url';

const FORBIDDEN_KEYS = new Set([
  'address',
  'api_key',
  'access_key',
  'authorization',
  'cookie',
  'customer_name',
  'customer_id',
  'device_id',
  'email',
  'em',
  'external_id',
  'fbc',
  'fbp',
  'first_name',
  'fn',
  'full_name',
  'ip',
  'last_name',
  'ln',
  'password',
  'ph',
  'phone',
  'private_key',
  'sccid',
  'session_id',
  'token',
  'ttp',
  'ttclid',
  'user_agent',
  'user_id',
]);
const MAX_DEPTH = 8;

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function isForbiddenKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (FORBIDDEN_KEYS.has(normalized)) return true;
  return /(^|_)(access_key|address|api_key|authorization|cookie|email|ip|password|phone|private_key|secret|token|user_agent)($|_)/.test(
    normalized
  );
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[depth-limited]';
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((entry) => redactValue(entry, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Set) {
    return [...value]
      .slice(0, 200)
      .map((entry) => redactValue(entry, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  const entries =
    value instanceof Map ? value.entries() : Object.entries(value);
  for (const [key, entry] of entries) {
    if (typeof key !== 'string' || isForbiddenKey(key)) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const normalizedKey = normalizeKey(key);
    redacted[key] =
      typeof entry === 'string' &&
      /(^|_)(url|referrer)(_|$)/.test(normalizedKey)
        ? sanitizeEventUrl(entry)
        : redactValue(entry, depth + 1);
  }
  return redacted;
}

export function redactEventPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return redactValue(payload, 0) as Record<string, unknown>;
}
