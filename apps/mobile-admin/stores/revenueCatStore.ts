import { Platform } from 'react-native';
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';

// Get keys from environment
const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

/**
 * Helper to check pro entitlement status - centralized to avoid drift
 */
const isProFromInfo = (info: CustomerInfo | null): boolean =>
    Boolean(info?.entitlements.active['pro'] || info?.entitlements.active['baci_pro']);

interface RevenueCatState {
    currentOffering: PurchasesOffering | null;
    customerInfo: CustomerInfo | null;
    isPro: boolean;
    isLoading: boolean;
    isInitializing: boolean; // Guard against concurrent init calls
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    purchasePackage: (pack: PurchasesPackage) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
}

export const useRevenueCatStore = create<RevenueCatState>((set, get) => ({
    currentOffering: null,
    customerInfo: null,
    isPro: false,
    isLoading: true,
    isInitializing: false,
    error: null,

    initialize: async () => {
        // Guard against concurrent initialization
        if (get().isInitializing) {
            return;
        }

        // Reset state at start
        set({ isLoading: true, error: null, isInitializing: true });

        try {
            if (Platform.OS === 'ios') {
                if (!API_KEY_IOS) {
                    console.warn('RevenueCat iOS API Key not found');
                    set({ isLoading: false, isInitializing: false, error: 'Configuration Error: iOS API Key missing' });
                    return;
                }
                Purchases.configure({ apiKey: API_KEY_IOS });
            } else if (Platform.OS === 'android') {
                if (!API_KEY_ANDROID) {
                    console.warn('RevenueCat Android API Key not found');
                    set({ isLoading: false, isInitializing: false, error: 'Configuration Error: Android API Key missing' });
                    return;
                }
                Purchases.configure({ apiKey: API_KEY_ANDROID });
            } else {
                set({ isLoading: false, isInitializing: false, error: 'Platform not supported' });
                return;
            }

            const info = await Purchases.getCustomerInfo();
            const offerings = await Purchases.getOfferings();

            set({
                customerInfo: info,
                currentOffering: offerings.current,
                isPro: isProFromInfo(info),
                isLoading: false,
                isInitializing: false,
                error: null,
            });

            // Listen for updates (outside the store action, usually setup in a useEffect, 
            // but for simplicity in this store we just fetch initial state.
            // A listener could be set up in the provider/hook wrapper)
        } catch (e: unknown) {
            console.error('RevenueCat initialization failed:', e);
            set({
                isLoading: false,
                isInitializing: false,
                error: e instanceof Error ? e.message : 'Initialization failed',
            });
        }
    },

    purchasePackage: async (pack: PurchasesPackage) => {
        try {
            set({ isLoading: true, error: null });
            const { customerInfo } = await Purchases.purchasePackage(pack);

            const isPro = isProFromInfo(customerInfo);

            set({
                customerInfo,
                isPro,
                isLoading: false,
            });

            return isPro;
        } catch (e: unknown) {
            // RevenueCat errors have a userCancelled property
            const error = e as { userCancelled?: boolean; message?: string };
            if (!error.userCancelled) {
                set({ error: error.message || 'Purchase failed', isLoading: false });
            } else {
                set({ isLoading: false });
            }
            return false;
        }
    },

    restorePurchases: async () => {
        try {
            set({ isLoading: true, error: null });
            const customerInfo = await Purchases.restorePurchases();

            const isPro = isProFromInfo(customerInfo);

            set({
                customerInfo,
                isPro,
                isLoading: false,
            });

            return isPro;
        } catch (e: unknown) {
            console.error('Restore failed:', e);
            set({
                error: e instanceof Error ? e.message : 'Restore failed',
                isLoading: false,
            });
            return false;
        }
    },
}));
