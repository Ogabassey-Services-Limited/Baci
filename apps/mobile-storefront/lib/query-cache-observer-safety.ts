import type { QueryClient } from '@tanstack/react-query';

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

  // Reset active observers in place, then refetch enabled public queries. This
  // clears account data while allowing the current guest screen to recover.
  void queryClient.resetQueries({ type: 'active' }).catch(() => undefined);
}
