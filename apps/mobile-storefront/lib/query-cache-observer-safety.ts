import type { QueryClient } from '@tanstack/react-query';

const ACCOUNT_QUERY_PREFIXES = new Set([
  'customer',
  'orders',
  'profile',
  'receipt-detail',
  'receipts',
  'saved',
  'vtu',
  'vtu-history',
  'wallet',
]);

function isAccountScopedQuery(query: { queryKey: readonly unknown[] }) {
  const prefix = query.queryKey[0];
  return typeof prefix === 'string' && ACCOUNT_QUERY_PREFIXES.has(prefix);
}

/**
 * Clears cached account data without disconnecting mounted query observers.
 * QueryClient.clear() removes active queries and their subscribers; a mounted
 * screen can then remain in a permanent pending state until it is remounted.
 */
export function clearQueryCachePreservingObservers(
  queryClient: QueryClient
): void {
  queryClient.removeQueries({ type: 'inactive' });
  queryClient.getMutationCache().clear();

  // Clear mounted account data without issuing a request under the old
  // identity. Public observers are reset below and may safely refetch.
  for (const query of queryClient
    .getQueryCache()
    .findAll({ type: 'active' })
    .filter(isAccountScopedQuery)) {
    query.reset();
  }

  // Reset active observers in place, then refetch enabled public queries. This
  // clears account data while allowing the current guest screen to recover.
  void queryClient
    .resetQueries({
      type: 'active',
      predicate: (query) => !isAccountScopedQuery(query),
    })
    .catch(() => undefined);
}
