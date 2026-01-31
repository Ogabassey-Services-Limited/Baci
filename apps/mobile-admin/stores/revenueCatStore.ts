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
const isProFromInfo = (info: CustomerInfo | null): boolean => {
  if (!info) return false;

  const activeKeys = Object.keys(info.entitlements.active);
  // 2026 Best Practice: Support multiple identifiers to prevent "Activation" delays 
  const possibleProKeys = ['pro', 'baci_pro', 'premium', 'all_features', 'monthly', 'yearly', 'default'];

  const isPro = activeKeys.some(key => possibleProKeys.includes(key.toLowerCase()));

  if (activeKeys.length > 0) {
    console.log('[RevenueCat] Active Entitlements:', activeKeys, 'Is Pro:', isPro);
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
}

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
        console.warn(`[RevenueCat] No API Key found for platform: ${Platform.OS}`);
        set({
          isLoading: false,
          isInitializing: false,
          isInitialized: true, // Mark as done to prevent spamming warnings
          error: `Missing API Key for ${Platform.OS}`
        });
        return;
      }

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
      Purchases.addCustomerInfoUpdateListener((newInfo) => {
        const proStatus = isProFromInfo(newInfo);
        set({
          customerInfo: newInfo,
          isPro: proStatus
        });
      });
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
      console.log('[RevenueCat] Starting purchase for:', pack.product.identifier);

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
}));
