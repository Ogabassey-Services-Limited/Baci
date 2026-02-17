'use client';

// Backward compatibility re-exports.
// All logic has moved to ./merchant/ module.
// This file ensures all existing consumers continue working without import changes.

export { MerchantProvider } from './merchant/merchant-provider';
export type {
  MerchantContextType,
  MerchantData,
  StaffAccess,
  StaffRole,
} from './merchant/types';
export { useMerchant, useMerchantSafe } from './merchant/use-merchant';
