import { useEffect } from 'react';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

export function useRevenueCat() {
  const store = useRevenueCatStore();

  useEffect(() => {
    // Initialize on mount if not already done
    // Guard: skip if already initializing or already initialized
    const needsInit = !store.isInitializing && !store.isInitialized;
    if (needsInit) {
      store.initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: one-time mount initialization
  }, [store]);

  return store;
}
