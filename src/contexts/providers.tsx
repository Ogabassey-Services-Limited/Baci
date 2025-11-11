
'use client';

import { AuthProvider } from './auth-context';
import { MerchantProvider } from '@/hooks/use-merchant';
import { CartProvider } from '@/hooks/use-cart';
import { ProductProvider } from './product-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MerchantProvider>
        <ProductProvider>
            <CartProvider>
            {children}
            </CartProvider>
        </ProductProvider>
      </MerchantProvider>
    </AuthProvider>
  );
}
