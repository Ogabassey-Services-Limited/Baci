import { useEffect } from 'react';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

export function useRevenueCat() {
  // Selecting all 11/11 store properties with useShallow provides no
  // performance benefit — revert to the bare hook.
  const store = useRevenueCatStore();

  useEffect(() => {
    // Initialize on mount if not already done
    // Guard: skip if already initializing or already initialized
    const needsInit = !store.isInitializing && !store.isInitialized;
    if (needsInit) {
      store.initialize();
    }

  }, [store]);

  return store;
}
