export type AuthProvider = 'password' | 'google' | 'apple';
export type AuthStage = 'start' | 'success' | 'failure' | 'cancel';
export type AuthLogLevel = 'log' | 'warn' | 'error';

export type AuthTelemetryPrimitive =
  | boolean
  | number
  | string
  | null
  | undefined;

interface AuthTelemetryEvent {
  at: string;
  code?: string;
  durationMs?: number;
  level: AuthLogLevel;
  metadata?: Record<string, AuthTelemetryPrimitive>;
  provider: AuthProvider;
  stage: AuthStage;
}

declare global {
  // biome-ignore lint/style/noVar: Global variables require var
  var __BACI_AUTH_TELEMETRY__: AuthTelemetryEvent[] | undefined;
}

const MAX_AUTH_EVENTS = 40;

function sanitizeMetadata(
  metadata?: Record<string, AuthTelemetryPrimitive>
): Record<string, AuthTelemetryPrimitive> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(metadata).filter(
    ([, value]) =>
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      value === null ||
      value === undefined
  );

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

function getAuthTelemetryBuffer(): AuthTelemetryEvent[] {
  if (!globalThis.__BACI_AUTH_TELEMETRY__) {
    globalThis.__BACI_AUTH_TELEMETRY__ = [];
  }

  return globalThis.__BACI_AUTH_TELEMETRY__;
}

function logTelemetryEvent(event: AuthTelemetryEvent): void {
  if (!__DEV__) {
    return;
  }

  const logger =
    event.level === 'error'
      ? console.error
      : event.level === 'warn'
        ? console.warn
        : console.log;

  logger('[AuthTelemetry]', event);
}

export function trackAuthTelemetry(input: {
  code?: string;
  durationMs?: number;
  level?: AuthLogLevel;
  metadata?: Record<string, AuthTelemetryPrimitive>;
  provider: AuthProvider;
  stage: AuthStage;
}): void {
  const metadata = sanitizeMetadata(input.metadata);
  const event: AuthTelemetryEvent = {
    at: new Date().toISOString(),
    level:
      input.level ??
      (input.stage === 'failure'
        ? 'error'
        : input.stage === 'cancel'
          ? 'warn'
          : 'log'),
    provider: input.provider,
    stage: input.stage,
    ...(input.code !== undefined && { code: input.code }),
    ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
    ...(metadata !== undefined && { metadata }),
  };

  const buffer = getAuthTelemetryBuffer();
  buffer.unshift(event);
  if (buffer.length > MAX_AUTH_EVENTS) {
    buffer.length = MAX_AUTH_EVENTS;
  }

  logTelemetryEvent(event);
}
