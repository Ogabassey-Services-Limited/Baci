// A simple logger to help with debugging.
// In a real production app, you would use a more robust logging service.

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Keys that should be redacted from logs to prevent sensitive data exposure
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'credential',
  'private',
  'credit_card',
  'card_number',
  'cvv',
  'ssn',
  'social_security',
];

/**
 * Recursively sanitize an object to redact sensitive fields
 */
function sanitizeForLogging(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion - reduced from 10 to 7 for performance
  if (depth > 7) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact strings that look like API keys or tokens, using more restrictive patterns:
    //  - Long strings with sensitive prefixes (e.g. Bearer, sk_)
    //  - JWTs (three base64url segments separated by .)
    //  - Very long hex/base64 strings (min length increased)
    const TOKEN_PREFIXES = [
      'Bearer ', 'bot ', 'sk_', 'pk_', 'rk_', // Stripe & general
      'eyJ', // JWTs (base64url-encoded JSON starts with eyJ)
      'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', // GitHub tokens
      'xoxb-', 'xoxp-', // Slack tokens
      'ya29.', // Google OAuth2
      'shpat_', 'shpca_', // Shopify tokens
    ];
    const hasSensitivePrefix = TOKEN_PREFIXES.some(prefix => obj.startsWith(prefix));
    // JWT: must have two dots, all segments base64url
    const isLikelyJwt = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(obj) && obj.length > 40;
    // Very long random-looking string (>50) and mostly base64/hex
    const isLongRandom = obj.length > 50 && /^[A-Za-z0-9+/=_-]+$/.test(obj);
    if (hasSensitivePrefix || isLikelyJwt || isLongRandom) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
  }

  if (obj instanceof Error) {
    return sanitizeErrorForLogging(obj, depth);
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains any sensitive keywords
    const isSensitive = SENSITIVE_KEYS.some(
      sensitiveKey => lowerKey.includes(sensitiveKey)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      // Always recursively sanitize all values (including primitives for string token detection)
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Convert an Error object into a sanitized serializable object for logging
 */
function sanitizeErrorForLogging(error: Error, depth = 0): Record<string, unknown> {
  // Only keep common fields and sanitize any extra (custom) fields
  const base: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  // Attach and sanitize custom fields (excluding built-in ones)
  for (const key of Object.keys(error)) {
    if (key !== 'name' && key !== 'message' && key !== 'stack') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      base[key] = sanitizeForLogging((error as any)[key], depth + 1);
    }
  }

  return base;
}

const log = (level: LogLevel, payload: LogPayload | Error) => {
  const timestamp = new Date().toISOString();
  if (payload instanceof Error) {
    // Sanitize Error objects to prevent leaking sensitive data in error properties
    const sanitizedError = sanitizeErrorForLogging(payload);
    console[level](
      `[${timestamp}] [${level.toUpperCase()}] ${sanitizedError.message}`,
      sanitizedError
    );
  } else {
    // Sanitize payload to remove sensitive data
    const sanitizedPayload = sanitizeForLogging(payload);

    // Safely extract message from sanitized payload
    const sanitizedMessage = typeof sanitizedPayload === 'object' && sanitizedPayload !== null && 'message' in sanitizedPayload && typeof sanitizedPayload.message === 'string'
      ? sanitizedPayload.message
      : '';

    // Check if there is an error object in the payload to log it correctly
    if (payload.error && payload.error instanceof Error) {
      // Use sanitized error from sanitizedPayload to prevent leaking sensitive data (avoid double sanitization)
      console[level](
        `[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}`,
        sanitizedPayload
      );
    } else {
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}`, {
        ...sanitizedPayload as Record<string, unknown>,
      });
    }
  }
};

export const logger = {
  info: (payload: LogPayload) => log('info', payload),
  warn: (payload: LogPayload) => log('warn', payload),
  error: (payload: LogPayload | Error) => log('error', payload),
};
