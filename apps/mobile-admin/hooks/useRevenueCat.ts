import { useEffect } from 'react';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

export function useRevenueCat() {
    const store = useRevenueCatStore();

    useEffect(() => {
        // Initialize on mount if not already done
        // Note: isLoading starts as true, so we check if we have no data AND no error
        // to determine if initialization is needed
        const needsInit = !store.currentOffering && !store.error;
        if (needsInit) {
            store.initialize();
        }
    }, []);

    return store;
}
