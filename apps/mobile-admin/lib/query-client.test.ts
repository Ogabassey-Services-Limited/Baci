import { beforeEach, describe, expect, it, vi } from 'vitest';

const mmkv = vi.hoisted(() => {
  const stores = new Map<
    string,
    {
      values: Map<string, string>;
      clearAll: ReturnType<typeof vi.fn>;
    }
  >();
  return { stores };
});

vi.mock('react-native-mmkv', () => ({
  createMMKV: ({ id }: { id: string }) => {
    const values = new Map<string, string>();
    const store = {
      values,
      clearAll: vi.fn(() => values.clear()),
    };
    mmkv.stores.set(id, store);
    return {
      clearAll: store.clearAll,
      getString: (key: string) => values.get(key),
      remove: (key: string) => values.delete(key),
      set: (key: string, value: string) => values.set(key, value),
    };
  },
}));

import {
  clearAdminQueryCache,
  queryClient,
  queryPersister,
} from './query-client';

describe('clearAdminQueryCache', () => {
  beforeEach(() => {
    queryClient.clear();
    for (const store of mmkv.stores.values()) {
      store.values.clear();
      store.clearAll.mockClear();
    }
  });

  it('clears both live TanStack data and persisted MMKV data before identity handoff', async () => {
    queryClient.setQueryData(['merchant', 'prior-user'], {
      id: 'prior-merchant',
    });
    await queryPersister.persistClient({
      buster: '',
      timestamp: Date.now(),
      clientState: { mutations: [], queries: [] },
    });

    clearAdminQueryCache();

    expect(
      queryClient.getQueryData(['merchant', 'prior-user'])
    ).toBeUndefined();
    expect(
      mmkv.stores.get('baci-admin-query-cache')?.clearAll
    ).toHaveBeenCalledOnce();
    expect(
      mmkv.stores.get('baci-admin-mutation-queue')?.clearAll
    ).toHaveBeenCalledOnce();
    expect(mmkv.stores.get('baci-admin-query-cache')?.values.size).toBe(0);
  });
});
