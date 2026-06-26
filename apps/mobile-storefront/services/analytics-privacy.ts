export type AnalyticsJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: AnalyticsJson }
  | AnalyticsJson[];

export type AnalyticsProperties = Record<string, AnalyticsJson>;

const REDACTED_VALUE = '[Filtered]';
const SENSITIVE_PROPERTY_TOKENS = new Set([
  'password',
  'passcode',
  'token',
  'secret',
  'authorization',
  'key',
  'credential',
  'credentials',
  'cookie',
  'otp',
  'pin',
  'cvv',
  'card',
  'bvn',
  'nin',
  'email',
  'phone',
  'address',
]);
const URL_PROPERTY_PATTERN = /(?:url|href|referrer|request_path|pathname)/i;
const QUERY_OR_HASH_PATTERN = /[?#]/;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_VALUE_PATTERNS = [
  /(?:\+\d[\d\s().-]{7,}\d|\b\d[\d\s().-]{7,}\d\b)/g,
  /\b(?:\d[ -]?){13,19}\b/g,
  /\b\d{11}\b/g,
  /\b(?:otp|pin|passcode|verification code|security code)\D{0,12}\d{4,8}\b/gi,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function removeUrlCredentials(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
      return url.toString();
    }
  } catch {
    // Fall through to scheme-less sanitization.
  }

  return value
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/?#@]+@/i, '$1')
    .replace(/^[^/?#@]+:[^/?#@]+@/, '');
}

function redactUrlQuery(value: string): string {
  const withoutCredentials = removeUrlCredentials(value);
  const markerIndex = withoutCredentials.search(QUERY_OR_HASH_PATTERN);
  return markerIndex === -1
    ? withoutCredentials
    : withoutCredentials.slice(0, markerIndex);
}

function redactSensitiveStringValues(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce(
    (sanitizedValue, pattern) =>
      sanitizedValue.replace(pattern, REDACTED_VALUE),
    value.replace(EMAIL_VALUE_PATTERN, REDACTED_VALUE)
  );
}

function isSensitivePropertyKey(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some(
      (token) =>
        SENSITIVE_PROPERTY_TOKENS.has(token) ||
        (token.endsWith('s') &&
          SENSITIVE_PROPERTY_TOKENS.has(token.slice(0, -1)))
    );
}

function sanitizeAnalyticsPropertyValue(
  key: string,
  value: unknown,
  seen: Set<object>
): AnalyticsJson | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isSensitivePropertyKey(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === 'string') {
    const sanitizedString = URL_PROPERTY_PATTERN.test(key)
      ? redactUrlQuery(value)
      : value;

    return redactSensitiveStringValues(sanitizedString);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);
    const sanitized = value
      .map((item) => sanitizeAnalyticsPropertyValue(key, item, seen))
      .filter((item): item is AnalyticsJson => item !== undefined);
    seen.delete(value);
    return sanitized;
  }

  if (isRecord(value)) {
    return sanitizeAnalyticsProperties(value, seen);
  }

  return undefined;
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | undefined,
  seen = new Set<object>()
): AnalyticsProperties | undefined {
  if (!properties) {
    return undefined;
  }

  if (seen.has(properties)) {
    return undefined;
  }

  seen.add(properties);

  const sanitized = Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => [
        key,
        sanitizeAnalyticsPropertyValue(key, value, seen),
      ])
      .filter(
        (entry): entry is [string, AnalyticsJson] => entry[1] !== undefined
      )
  );
  seen.delete(properties);

  return sanitized;
}

interface AnalyticsCaptureEventLike {
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}

type SanitizedAnalyticsCaptureEvent<T extends AnalyticsCaptureEventLike> = Omit<
  T,
  '$set' | '$set_once' | 'properties'
> & {
  properties?: AnalyticsProperties;
  $set?: AnalyticsProperties;
  $set_once?: AnalyticsProperties;
};

export function sanitizeAnalyticsCaptureEvent<T extends AnalyticsCaptureEventLike>(
  event: T | null
): SanitizedAnalyticsCaptureEvent<T> | null {
  if (!event) {
    return null;
  }

  return {
    ...event,
    properties: sanitizeAnalyticsProperties(event.properties),
    $set: sanitizeAnalyticsProperties(event.$set),
    $set_once: sanitizeAnalyticsProperties(event.$set_once),
  };
}
