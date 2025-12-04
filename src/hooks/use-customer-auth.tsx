'use client';

export type {
  Customer,
  CustomerUser,
  SavedAddress,
} from '@/contexts/customer-auth-context';
// Re-export from context for convenience
export {
  CustomerAuthProvider,
  useCustomerAuth,
} from '@/contexts/customer-auth-context';
