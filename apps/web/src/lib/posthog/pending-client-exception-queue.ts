import { toJsonSafePostHogValue } from '@/lib/posthog/json-safe-value';

const STORAGE_KEY = 'baci:posthog:pending-client-exceptions:v1';
const MAX_PENDING_EXCEPTIONS = 5;
const MAX_PENDING_AGE_MS = 30 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 4_000;
const MAX_ERROR_STACK_LENGTH = 16_000;

interface SerializedError {
  kind: 'error';
  message: string;
  name: string;
  stack?: string;
}

interface SerializedValue {
  kind: 'value';
  value: unknown;
}

interface SerializedUndefined {
  kind: 'undefined';
}

type SerializedException =
  | SerializedError
  | SerializedUndefined
  | SerializedValue;

interface StoredClientException {
  error: SerializedException;
  id: string;
  properties?: Record<string, unknown>;
  queuedAt: number;
}

export interface QueuedClientException {
  error: unknown;
  id: string;
  properties?: Record<string, unknown>;
  queuedAt: number;
}

let volatileQueue: StoredClientException[] = [];

function getSessionStorage(): Storage | undefined {
  try {
    return typeof globalThis.sessionStorage === 'undefined'
      ? undefined
      : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSerializedException(value: unknown): value is SerializedException {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind === 'error') {
    return (
      typeof value.message === 'string' &&
      typeof value.name === 'string' &&
      (value.stack === undefined || typeof value.stack === 'string')
    );
  }

  if (value.kind === 'undefined') {
    return true;
  }

  return value.kind === 'value' && 'value' in value;
}

function isStoredClientException(
  value: unknown
): value is StoredClientException {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.queuedAt === 'number' &&
    Number.isFinite(value.queuedAt) &&
    isSerializedException(value.error) &&
    (value.properties === undefined || isRecord(value.properties))
  );
}

function normalizeProperties(
  properties: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const normalized = toJsonSafePostHogValue(properties);
  return isRecord(normalized) ? normalized : undefined;
}

function serializeException(error: unknown): SerializedException {
  if (error instanceof Error) {
    return {
      kind: 'error',
      message: error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      name: error.name.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      ...(error.stack
        ? { stack: error.stack.slice(0, MAX_ERROR_STACK_LENGTH) }
        : {}),
    };
  }

  if (error === undefined) {
    return { kind: 'undefined' };
  }

  return {
    kind: 'value',
    value: toJsonSafePostHogValue(
      typeof error === 'string'
        ? error.slice(0, MAX_ERROR_MESSAGE_LENGTH)
        : error
    ),
  };
}

function deserializeException(error: SerializedException): unknown {
  if (error.kind === 'undefined') {
    return undefined;
  }

  if (error.kind === 'value') {
    return error.value;
  }

  const restoredError = new Error(error.message);
  restoredError.name = error.name;
  if (error.stack) {
    restoredError.stack = error.stack;
  }
  return restoredError;
}

function dedupeAndBound(
  entries: StoredClientException[],
  now = Date.now()
): StoredClientException[] {
  const byId = new Map<string, StoredClientException>();

  for (const entry of entries) {
    if (now - entry.queuedAt <= MAX_PENDING_AGE_MS) {
      byId.set(entry.id, entry);
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => left.queuedAt - right.queuedAt)
    .slice(-MAX_PENDING_EXCEPTIONS);
}

function readStoredEntries(): StoredClientException[] {
  const storage = getSessionStorage();
  let persistedEntries: StoredClientException[] = [];

  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        persistedEntries = parsed.filter(isStoredClientException);
      }
    } catch {
      // The volatile fallback below keeps this page's queue usable when browser
      // privacy settings or a malformed storage value make persistence fail.
    }
  }

  return dedupeAndBound([...persistedEntries, ...volatileQueue]);
}

function writeStoredEntries(entries: StoredClientException[]): void {
  const boundedEntries = dedupeAndBound(entries);
  const storage = getSessionStorage();

  if (storage) {
    try {
      if (boundedEntries.length === 0) {
        storage.removeItem(STORAGE_KEY);
      } else {
        storage.setItem(STORAGE_KEY, JSON.stringify(boundedEntries));
      }
      volatileQueue = [];
      return;
    } catch {
      // Fall through to the in-memory copy. Sanitized values remain available
      // for this document even if the browser refuses sessionStorage writes.
    }
  }

  volatileQueue = boundedEntries;
}

function hydrateEntry(entry: StoredClientException): QueuedClientException {
  return {
    error: deserializeException(entry.error),
    id: entry.id,
    properties: entry.properties,
    queuedAt: entry.queuedAt,
  };
}

function persistEntry(entry: QueuedClientException): StoredClientException {
  return {
    error: serializeException(entry.error),
    id: entry.id,
    properties: normalizeProperties(entry.properties),
    queuedAt: entry.queuedAt,
  };
}

function createQueueId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * A bounded, session-backed handoff for sanitized client exceptions whose
 * PostHog SDK chunk cannot load. `take` and `drain` remove entries before
 * returning them, so the direct import path and idle browser boot cannot emit
 * the same exception twice.
 */
export const pendingClientExceptionQueue = {
  clear(): void {
    volatileQueue = [];
    try {
      getSessionStorage()?.removeItem(STORAGE_KEY);
    } catch {
      // Queue cleanup is best-effort in storage-restricted browsers.
    }
  },

  drain(): QueuedClientException[] {
    const entries = readStoredEntries();
    writeStoredEntries([]);
    return entries.map(hydrateEntry);
  },

  enqueue(error: unknown, properties?: Record<string, unknown>): string {
    const id = createQueueId();
    writeStoredEntries([
      ...readStoredEntries(),
      {
        error: serializeException(error),
        id,
        properties: normalizeProperties(properties),
        queuedAt: Date.now(),
      },
    ]);
    return id;
  },

  restore(entry: QueuedClientException): void {
    writeStoredEntries([...readStoredEntries(), persistEntry(entry)]);
  },

  take(id: string): QueuedClientException | undefined {
    const entries = readStoredEntries();
    const claimedEntry = entries.find((entry) => entry.id === id);
    if (!claimedEntry) {
      return undefined;
    }

    writeStoredEntries(entries.filter((entry) => entry.id !== id));
    return hydrateEntry(claimedEntry);
  },
};
