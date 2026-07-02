import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPostHogPersistenceKey,
  readPostHogPersistedIdentity,
  readPostHogPersistenceRecord,
} from './persisted-identity';

const TOKEN = 'ph_public';

function stubStorage(initialEntries: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initialEntries));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPostHogPersistenceKey', () => {
  it('builds the posthog-js localStorage persistence key for a project token', () => {
    expect(getPostHogPersistenceKey(TOKEN)).toBe('ph_ph_public_posthog');
  });
});

describe('readPostHogPersistedIdentity', () => {
  it('reads distinct ID, device ID, and session ID from a valid payload', () => {
    stubStorage({
      [getPostHogPersistenceKey(TOKEN)]: JSON.stringify({
        $device_id: 'device-1',
        $sesid: [1234567890, 'session-abc', 1234560000],
        distinct_id: 'distinct-1',
      }),
    });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({
      deviceId: 'device-1',
      distinctId: 'distinct-1',
      sessionId: 'session-abc',
    });
  });

  it('decodes a URI-encoded persistence payload', () => {
    const encoded = encodeURIComponent(
      JSON.stringify({ distinct_id: 'encoded-distinct-id' })
    );
    stubStorage({ [getPostHogPersistenceKey(TOKEN)]: encoded });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({
      deviceId: undefined,
      distinctId: 'encoded-distinct-id',
      sessionId: undefined,
    });
  });

  it('returns an empty identity for malformed JSON', () => {
    stubStorage({ [getPostHogPersistenceKey(TOKEN)]: '{not-json' });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({});
  });

  it('returns an empty identity when the storage key is missing', () => {
    stubStorage();

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({});
  });

  it('returns an empty identity for a non-object payload', () => {
    stubStorage({
      [getPostHogPersistenceKey(TOKEN)]: JSON.stringify([1, 2, 3]),
    });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({});
  });

  it('ignores a non-array $sesid shape', () => {
    stubStorage({
      [getPostHogPersistenceKey(TOKEN)]: JSON.stringify({
        $sesid: 'not-an-array',
        distinct_id: 'distinct-1',
      }),
    });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({
      deviceId: undefined,
      distinctId: 'distinct-1',
      sessionId: undefined,
    });
  });

  it('ignores a $sesid array whose session entry is not a string', () => {
    stubStorage({
      [getPostHogPersistenceKey(TOKEN)]: JSON.stringify({
        $sesid: [1234567890, 42, 1234560000],
        distinct_id: 'distinct-1',
      }),
    });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({
      deviceId: undefined,
      distinctId: 'distinct-1',
      sessionId: undefined,
    });
  });

  it('returns an empty identity when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });

    expect(readPostHogPersistedIdentity(TOKEN)).toEqual({});
  });
});

describe('readPostHogPersistenceRecord', () => {
  it('returns the raw parsed persistence record', () => {
    stubStorage({
      [getPostHogPersistenceKey(TOKEN)]: JSON.stringify({
        $extra_field: 'kept-as-is',
        distinct_id: 'distinct-1',
      }),
    });

    expect(readPostHogPersistenceRecord(TOKEN)).toEqual({
      $extra_field: 'kept-as-is',
      distinct_id: 'distinct-1',
    });
  });

  it('returns undefined when nothing is persisted', () => {
    stubStorage();

    expect(readPostHogPersistenceRecord(TOKEN)).toBeUndefined();
  });
});
