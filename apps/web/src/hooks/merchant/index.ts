// Types

// Constants
export { defaultStaffAccess, ownerStaffAccess } from './constants';
// Provider
export { MerchantContext } from './merchant-context';
export { MerchantProvider } from './merchant-provider';
// Mock data
export { DEMO_MERCHANTS, getDemoMerchant } from './mock-data';
// Queries (for advanced consumers)
export {
  fetchDashboardMerchant,
  fetchMerchantBySlug,
  fetchPrimaryDomain,
  normalizeFeatureSettings,
} from './queries';
export { StorefrontMerchantProvider } from './storefront-merchant-provider';
export type {
  MerchantContextType,
  MerchantData,
  MerchantProviderProps,
  StaffAccess,
  StaffRole,
} from './types';
// Hooks
export { useMerchant, useMerchantSafe } from './use-merchant';
