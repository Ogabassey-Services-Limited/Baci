import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';
import {
  getRuntimePlatform,
  isRuntimePlatform,
  selectRuntimePlatform,
} from '@/config/runtime-platform';

/** Typed interface for the subset of Purchases methods actually used in this store */
interface PurchasesModule {
  configure(config: { apiKey: string }): void;
  getCustomerInfo(): Promise<CustomerInfo>;
  getOfferings(): Promise<PurchasesOfferings>;
  addCustomerInfoUpdateListener(
    listener: (info: CustomerInfo) => void
  ): (() => void) | undefined;
  purchasePackage(
    aPackage: PurchasesPackage
  ): Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases(): Promise<CustomerInfo>;
}

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Purchases: PurchasesModule | null = null;

const loadNativeModules = async () => {
  if (isRuntimePlatform('web')) return;
  try {
    const purchasesModule = await import('react-native-purchases');
    Purchases = purchasesModule.default as unknown as PurchasesModule;
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
let customerInfoListenerRemove: (() => void) | undefined | null = null;

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
      // Ensure native module is loaded (module-level call may not have resolved yet)
      if (!Purchases) await loadNativeModules();

      const apiKey = selectRuntimePlatform({
        ios: API_KEY_IOS,
        android: API_KEY_ANDROID,
        default: null,
      });
      const runtimePlatform = getRuntimePlatform();

      if (!apiKey) {
        console.warn(
          `[RevenueCat] No API Key found for platform: ${runtimePlatform}`
        );
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
          error: `Missing API Key for ${runtimePlatform}`,
        });
        return;
      }

      // Guard: Ensure we are on native and Purchases is available
      const purchasesRef = Purchases;
      if (isRuntimePlatform('web') || !purchasesRef) {
        console.warn(
          '[RevenueCat] Purchases module not available on this platform'
        );
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
        });
        return;
      }

      try {
        purchasesRef.configure({ apiKey });

        const info = await purchasesRef.getCustomerInfo();
        const offerings = await purchasesRef.getOfferings();

        // FIX: Check if initialization was cancelled/cleaned up
        if (!get().isInitializing) {
          return;
        }

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
        // Clean up any existing listener first to prevent leaks
        if (typeof customerInfoListenerRemove === 'function') {
          customerInfoListenerRemove();
        }

        customerInfoListenerRemove = purchasesRef.addCustomerInfoUpdateListener(
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
      if (!Purchases) {
        set({ error: 'Purchases not initialized', isLoading: false });
        return false;
      }
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
      if (!Purchases) {
        set({ error: 'Purchases not initialized', isLoading: false });
        return false;
      }
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
