const POSTHOG_SDK_PERSISTENCE_KEY_PREFIX = 'ph_';
const POSTHOG_SDK_PERSISTENCE_KEY_SUFFIX = '_posthog';

export interface PostHogPersistedIdentity {
  distinctId?: string;
  sessionId?: string;
  deviceId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property : undefined;
}

function readStorageValue(key: string): string | undefined {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function parsePostHogPersistenceValue(
  value: string | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    // Some storage adapters persist raw JSON. Ignore invalid URI encodings.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next supported PostHog persistence encoding.
    }
  }

  return undefined;
}

/**
 * The localStorage key posthog-js's localStorage persistence adapter uses
 * for a given project token.
 */
export function getPostHogPersistenceKey(projectToken: string): string {
  return `${POSTHOG_SDK_PERSISTENCE_KEY_PREFIX}${projectToken}${POSTHOG_SDK_PERSISTENCE_KEY_SUFFIX}`;
}

/**
 * Reads and parses posthog-js's raw persisted state for a project token,
 * tolerating both plain-JSON and URI-encoded storage values. Callers that
 * only need the standard identity fields should prefer
 * `readPostHogPersistedIdentity`; this is exposed for callers (like the
 * public blog pageview beacon) that need to preserve unrelated persisted
 * fields when writing the value back.
 */
export function readPostHogPersistenceRecord(
  projectToken: string
): Record<string, unknown> | undefined {
  return parsePostHogPersistenceValue(
    readStorageValue(getPostHogPersistenceKey(projectToken))
  );
}

/**
 * Reads posthog-js's persisted identity (distinct ID, device ID, session
 * ID) straight out of its localStorage persistence, without depending on
 * the posthog-js runtime itself — which may be unavailable, e.g. during a
 * chunk-load outage, or simply not yet initialized on a lightweight page
 * like the public blog.
 */
export function readPostHogPersistedIdentity(
  projectToken: string
): PostHogPersistedIdentity {
  const persistence = readPostHogPersistenceRecord(projectToken);
  if (!persistence) {
    return {};
  }

  const sessionEntry = Array.isArray(persistence.$sesid)
    ? persistence.$sesid[1]
    : undefined;

  return {
    deviceId: getStringProperty(persistence, '$device_id'),
    distinctId: getStringProperty(persistence, 'distinct_id'),
    sessionId: typeof sessionEntry === 'string' ? sessionEntry : undefined,
  };
}
