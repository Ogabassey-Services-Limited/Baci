import { useEffect } from 'react';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

export function useRevenueCat() {
    const store = useRevenueCatStore();

    useEffect(() => {
        // Initialize on mount if not already done or if needed
        // The store keeps state, but we might want to ensure freshness
        // For now, we rely on the implementation where app calls initialize() once usually.
        // However, to make it robust, we can check if it's uninitialized.
        if (!store.currentOffering && !store.isLoading && !store.error) {
            store.initialize();
        }
        // Or strictly rely on a root provider to call initialize().
        // Let's stick to the store having an initialize method that components can call if needed,
        // but typically we'll call it in the Root Layout.
    }, []);

    return store;
}
