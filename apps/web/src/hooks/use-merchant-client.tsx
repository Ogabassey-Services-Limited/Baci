'use client';

// Client-runtime re-exports for the merchant hook.
//
// Use this path from Client Components that need to consume the merchant
// hook or render the provider. Server Components should import types from
// `@/hooks/use-merchant` (the types-only sibling) instead — it has no
// 'use client' directive and produces no client-boundary work.

export { MerchantProvider } from './merchant/merchant-provider';
export { useMerchant, useMerchantSafe } from './merchant/use-merchant';
