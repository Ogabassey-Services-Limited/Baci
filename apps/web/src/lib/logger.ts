// A simple logger to help with debugging.
// In a real production app, you would use a more robust logging service.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  // biome-ignore lint/suspicious/noExplicitAny: Logger needs to handle any type
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
 * Recursively sanitize an object to redact sensitive fields and prevent log injection.
 * Strips control characters and line breaks from all strings.
 */
function sanitizeForLogging(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion - reduced from 10 to 7 for performance
  if (depth > 7) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // 1. Prevention of Log Injection (CRLF / Control Characters)
    // Replace all ASCII control characters (0x00-0x1F, 0x7F) including \r and \n
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control chars for sanitization
    const cleanStr = obj.replace(/[\x00-\x1F\x7F]/g, ' ');

    // 2. Sensitive Data Redaction
    // Redact strings that look like API keys or tokens, using more restrictive patterns:
    //  - Long strings with sensitive prefixes (e.g. Bearer, sk_)
    //  - JWTs (three base64url segments separated by .)
    //  - Very long hex/base64 strings (min length increased)
    const TOKEN_PREFIXES = [
      'Bearer ',
      'bot ',
      'sk_',
      'pk_',
      'rk_', // Stripe & general
      'eyJ', // JWTs (base64url-encoded JSON starts with eyJ)
      'ghp_',
      'gho_',
      'ghu_',
      'ghs_',
      'ghr_', // GitHub tokens
      'xoxb-',
      'xoxp-', // Slack tokens
      'ya29.', // Google OAuth2
      'shpat_',
      'shpca_', // Shopify tokens
    ];
    const hasSensitivePrefix = TOKEN_PREFIXES.some((prefix) =>
      cleanStr.startsWith(prefix)
    );
    // JWT: must have two dots, all segments base64url
    const isLikelyJwt =
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(cleanStr) &&
      cleanStr.length > 40;
    // Very long random-looking string (>50) and mostly base64/hex
    const isLongRandom =
      cleanStr.length > 50 && /^[A-Za-z0-9+/=_-]+$/.test(cleanStr);

    if (hasSensitivePrefix || isLikelyJwt || isLongRandom) {
      return '[REDACTED_TOKEN]';
    }

    return cleanStr;
  }

  if (obj instanceof Error) {
    return sanitizeErrorForLogging(obj, depth);
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains any sensitive keywords
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey)
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
 * Public helper to sanitize a single value for logging.
 * Useful for one-off sanitization.
 */
export function sanitizeForLog(value: unknown, maxLength = 1000): string {
  const sanitized = sanitizeForLogging(value);
  const str =
    typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
  return str.slice(0, maxLength);
}

function sanitizeErrorForLogging(
  error: Error,
  depth = 0
): Record<string, unknown> {
  // SECURITY FIX: Sanitize message and stack to prevent token leakage
  // Error messages may contain sensitive data like "Failed with token: sk_live_123"
  const base: Record<string, unknown> = {
    name: error.name,
    message:
      typeof error.message === 'string'
        ? (sanitizeForLogging(error.message, depth + 1) as string)
        : error.message,
    stack:
      typeof error.stack === 'string'
        ? (sanitizeForLogging(error.stack, depth + 1) as string)
        : error.stack,
  };

  // Attach and sanitize custom fields (excluding built-in ones)
  for (const key of Object.keys(error)) {
    if (key !== 'name' && key !== 'message' && key !== 'stack') {
      // biome-ignore lint/suspicious/noExplicitAny: Error properties can be any type
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
    const sanitizedMessage =
      typeof sanitizedPayload === 'object' &&
      sanitizedPayload !== null &&
      'message' in sanitizedPayload &&
      typeof sanitizedPayload.message === 'string'
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
      console[level](
        `[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}`,
        {
          ...(sanitizedPayload as Record<string, unknown>),
        }
      );
    }
  }
};

export const logger = {
  debug: (payload: LogPayload) => log('debug', payload),
  info: (payload: LogPayload) => log('info', payload),
  warn: (payload: LogPayload) => log('warn', payload),
  error: (payload: LogPayload | Error) => log('error', payload),
};
