import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Purchases: any = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const purchasesModule = await import('react-native-purchases');
    Purchases = purchasesModule.default;
  } catch (e) {
    console.debug('[RevenueCat] Native module ignored or failed to load:', e);
  }
};

loadNativeModules();

// Get keys from environment
const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

/**
 * Helper to check pro entitlement status - centralized to avoid drift
 */
const isProFromInfo = (info: CustomerInfo | null): boolean => {
  if (!info) return false;

  const activeKeys = Object.keys(info.entitlements.active);
  // 2026 Best Practice: Support multiple identifiers to prevent "Activation" delays
  const possibleProKeys = [
    'pro',
    'baci_pro',
    'premium',
    'all_features',
    'monthly',
    'yearly',
    'default',
  ];

  const isPro = activeKeys.some((key) =>
    possibleProKeys.includes(key.toLowerCase())
  );

  if (activeKeys.length > 0 && __DEV__) {
    console.log(
      '[RevenueCat] Active Entitlements:',
      activeKeys,
      'Is Pro:',
      isPro
    );
  }

  return isPro;
};

interface RevenueCatState {
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  purchasePackage: (pack: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cleanup: () => void;
}

// Store listener subscription for cleanup on logout
// Note: addCustomerInfoUpdateListener may return void in newer SDK versions
let customerInfoListenerRemove: (() => void) | void | null = null;

export const useRevenueCatStore = create<RevenueCatState>((set, get) => ({
  currentOffering: null,
  customerInfo: null,
  isPro: false,
  isLoading: true,
  isInitializing: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitializing || get().isInitialized) return;

    set({ isLoading: true, error: null, isInitializing: true });

    try {
      const apiKey = Platform.select({
        ios: API_KEY_IOS,
        android: API_KEY_ANDROID,
        default: null,
      });

      if (!apiKey) {
        console.warn(
          `[RevenueCat] No API Key found for platform: ${Platform.OS}`
        );
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
          error: `Missing API Key for ${Platform.OS}`,
        });
        return;
      }

      // Guard: Ensure we are on native and Purchases is available
      if (Platform.OS === 'web' || !Purchases) {
        console.warn('[RevenueCat] Purchases module not available on this platform');
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
        });
        return;
      }

      try {
        Purchases.configure({ apiKey });

        const info = await Purchases.getCustomerInfo();
        const offerings = await Purchases.getOfferings();

        set({
          customerInfo: info,
          currentOffering: offerings.current,
          isPro: isProFromInfo(info),
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
          error: null,
        });

        // Reactive Pattern: Automatically sync state on server confirmation
        customerInfoListenerRemove = Purchases.addCustomerInfoUpdateListener(
          (newInfo: CustomerInfo) => {
            const proStatus = isProFromInfo(newInfo);
            set({
              customerInfo: newInfo,
              isPro: proStatus,
            });
          }
        );
      } catch (innerError: unknown) {
        console.warn('[RevenueCat] Native configuration failed:', innerError);
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
          error: 'Native module configuration failed',
        });
      }
    } catch (e: unknown) {
      console.warn('[RevenueCat] Initialization notice:', e);
      set({
        isLoading: false,
        isInitializing: false,
        isInitialized: true,
        error: e instanceof Error ? e.message : 'Initialization failed',
      });
    }
  },

  purchasePackage: async (pack: PurchasesPackage) => {
    try {
      set({ isLoading: true, error: null });
      if (__DEV__) {
        console.log(
          '[RevenueCat] Starting purchase for:',
          pack.product.identifier
        );
      }

      const { customerInfo } = await Purchases.purchasePackage(pack);
      const isPro = isProFromInfo(customerInfo);

      set({
        customerInfo,
        isPro,
        isLoading: false,
      });

      return isPro;
    } catch (e: unknown) {
      // 2026 Dev Practice: Use debug for simulated/cancelled errors to avoid Red Screen in Expo Go
      console.debug('[RevenueCat] Purchase interaction:', e);

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
      console.debug('[RevenueCat] Restore notice:', e);
      set({
        error: e instanceof Error ? e.message : 'Restore failed',
        isLoading: false,
      });
      return false;
    }
  },

  cleanup: () => {
    // Remove listener to prevent memory leak and data mixing between users
    if (typeof customerInfoListenerRemove === 'function') {
      customerInfoListenerRemove();
      customerInfoListenerRemove = null;
      if (__DEV__) {
        console.log('[RevenueCat] Listener cleaned up');
      }
    }

    // Reset state to initial values
    set({
      currentOffering: null,
      customerInfo: null,
      isPro: false,
      isLoading: true,
      isInitializing: false,
      isInitialized: false,
      error: null,
    });
  },
}));
