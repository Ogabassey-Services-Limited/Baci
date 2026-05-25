/**
 * Tests for query-client — verifies QueryClient defaults, persister
 * configuration, and QUERY_CACHE_KEYS constants.
 */

import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { QUERY_CACHE_KEYS, queryClient, queryPersister } from './query-client';

describe('queryPersister', () => {
  it('is defined and has persister interface methods', () => {
    expect(queryPersister).toBeDefined();
    expect(typeof queryPersister.persistClient).toBe('function');
    expect(typeof queryPersister.restoreClient).toBe('function');
    expect(typeof queryPersister.removeClient).toBe('function');
  });
});

describe('queryClient', () => {
  it('is a QueryClient instance', () => {
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getQueryCache).toBe('function');
    expect(typeof queryClient.getMutationCache).toBe('function');
  });

  it('has staleTime set to 5 minutes', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
  });

  it('has gcTime set to 24 hours', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 60 * 24);
  });

  it('retries failed queries up to 2 times', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
  });

  it('uses offlineFirst network mode for queries', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.networkMode).toBe('offlineFirst');
  });

  it('uses online network mode for mutations', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.networkMode).toBe('online');
  });

  it('does not refetch on window focus (mobile has no window focus)', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('refetches on mount and reconnect', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnMount).toBe(true);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
  });

  it('has exponential backoff retry delay capped at 30s', () => {
    const defaults = queryClient.getDefaultOptions();
    const retryDelay = defaults.queries?.retryDelay;
    if (typeof retryDelay !== 'function') {
      throw new Error('retryDelay should be a function');
    }
    // attempt 0: min(1000*1, 30000) = 1000
    expect(retryDelay(0, new Error('test'))).toBe(1000);
    // attempt 1: min(1000*2, 30000) = 2000
    expect(retryDelay(1, new Error('test'))).toBe(2000);
    // attempt 2: min(1000*4, 30000) = 4000
    expect(retryDelay(2, new Error('test'))).toBe(4000);
    // attempt 10: min(1000*1024, 30000) = 30000 (capped)
    expect(retryDelay(10, new Error('test'))).toBe(30000);
  });
});

describe('QUERY_CACHE_KEYS', () => {
  it('has string keys for top-level collections', () => {
    expect(QUERY_CACHE_KEYS.products).toBe('products');
    expect(QUERY_CACHE_KEYS.categories).toBe('categories');
    expect(QUERY_CACHE_KEYS.wallet).toBe('wallet');
    expect(QUERY_CACHE_KEYS.orders).toBe('orders');
  });

  it('product() returns a tuple with slug', () => {
    expect(QUERY_CACHE_KEYS.product('test-slug')).toEqual([
      'product',
      'test-slug',
    ]);
  });

  it('pageConfig() returns a tuple with page name', () => {
    expect(QUERY_CACHE_KEYS.pageConfig('home')).toEqual(['pageConfig', 'home']);
  });
});
