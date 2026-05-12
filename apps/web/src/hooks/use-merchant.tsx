// Backward compatibility re-exports.
// All logic has moved to ./merchant/ module.
//
// This file intentionally has NO 'use client' directive. The underlying
// `./merchant/merchant-provider.tsx` and `./merchant/use-merchant.ts` already
// carry their own 'use client' tags where required, so the client boundary is
// marked correctly at the source modules. Keeping this shim non-client lets
// Server Components import types from this path without crossing the client
// boundary.

export { MerchantProvider } from './merchant/merchant-provider';
export type {
  MerchantContextType,
  MerchantData,
  StaffAccess,
  StaffRole,
} from './merchant/types';
export { useMerchant, useMerchantSafe } from './merchant/use-merchant';
