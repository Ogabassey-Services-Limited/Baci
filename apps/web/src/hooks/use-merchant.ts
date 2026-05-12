// Types-only re-exports for the merchant hook surface.
//
// Server Components can import from this path safely — there is no
// client boundary crossing. Client Components needing the actual
// MerchantProvider / useMerchant / useMerchantSafe should import from
// `@/hooks/use-merchant-client` instead.

export type {
  MerchantContextType,
  MerchantData,
  StaffAccess,
  StaffRole,
} from './merchant/types';
