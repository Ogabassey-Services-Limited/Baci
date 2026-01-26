import { useEffect } from 'react';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

export function useRevenueCat() {
    const store = useRevenueCatStore();

    useEffect(() => {
        // Initialize on mount if not already done
        // Guard: skip if already initializing, has data, or has error
        const needsInit = !store.isInitializing && !store.currentOffering && !store.error;
        if (needsInit) {
            store.initialize();
        }
    }, []);

    return store;
}
