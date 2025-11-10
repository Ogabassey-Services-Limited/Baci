
'use client';

import { AuthProvider } from './auth-context';
import { MerchantProvider } from '@/hooks/use-merchant';
import { CartProvider } from '@/hooks/use-cart';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MerchantProvider>
        <CartProvider>
          {children}
        </CartProvider>
      </MerchantProvider>
    </AuthProvider>
  );
}
