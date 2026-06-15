import { QUERY_CACHE_STORAGE_KEY } from '@/lib/query-client';

const CLEAR_CACHE_PRESERVED_KEYS = new Set([
  'app-settings-storage',
  'app-theme-storage',
  'auth-storage',
  'cart-storage',
  'comparison-storage',
  'saved-storage',
  'search_history',
]);

const CLEAR_CACHE_PRESERVED_PREFIXES = [
  'supabase',
  'baci:savings-reminder-',
] as const;

const CLEAR_CACHE_PREFIXES = [
  'cache:',
  'image-cache:',
  'product-cache:',
] as const;

function isClearableCacheStorageKey(key: string): boolean {
  if (CLEAR_CACHE_PRESERVED_KEYS.has(key)) {
    return false;
  }

  if (CLEAR_CACHE_PRESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return false;
  }

  return (
    key === QUERY_CACHE_STORAGE_KEY ||
    CLEAR_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function getClearableCacheStorageKeys(
  storageKeys: Iterable<string>
): string[] {
  const keys = new Set(storageKeys);
  keys.add(QUERY_CACHE_STORAGE_KEY);
  return Array.from(keys).filter(isClearableCacheStorageKey);
}
