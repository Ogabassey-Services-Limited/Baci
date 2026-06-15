import { getClearableCacheStorageKeys } from './clear-cache-keys';

describe('getClearableCacheStorageKeys', () => {
  it('keeps cache keys visible from MMKV and legacy storage', () => {
    expect(
      getClearableCacheStorageKeys([
        'REACT_QUERY_OFFLINE_CACHE',
        'cache:product-list',
        'image-cache:hero',
        'product-cache:featured',
      ])
    ).toEqual([
      'REACT_QUERY_OFFLINE_CACHE',
      'cache:product-list',
      'image-cache:hero',
      'product-cache:featured',
    ]);
  });

  it('preserves durable user state while adding the query cache key', () => {
    expect(
      getClearableCacheStorageKeys([
        'cart-storage',
        'comparison-storage',
        'saved-storage',
        'search_history',
        'supabase.auth.token',
        'app-settings-storage',
        'app-theme-storage',
        'auth-storage',
        'baci:savings-reminder-goal-id',
      ])
    ).toEqual(['REACT_QUERY_OFFLINE_CACHE']);
  });
});
