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
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact strings that look like API keys or tokens (long hex/base64 strings)
    if (obj.length > 32 && /^[a-zA-Z0-9+/=_-]+$/.test(obj)) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
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
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

const log = (level: LogLevel, payload: LogPayload | Error) => {
  const timestamp = new Date().toISOString();
  if (payload instanceof Error) {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${payload.message}`, payload);
  } else {
    // Sanitize payload to remove sensitive data
    const sanitizedPayload = sanitizeForLogging(payload) as LogPayload;

    // Check if there is an error object in the payload to log it correctly
    if (payload.error && payload.error instanceof Error) {
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${sanitizedPayload.message}`, payload.error);
    } else {
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${sanitizedPayload.message}`, {
        ...sanitizedPayload,
      });
    }
  }
};

export const logger = {
  info: (payload: LogPayload) => log('info', payload),
  warn: (payload: LogPayload) => log('warn', payload),
  error: (payload: LogPayload | Error) => log('error', payload),
};
