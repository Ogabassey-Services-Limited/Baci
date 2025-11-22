
'use client';

import { AuthProvider } from './auth-context';
import { CartProvider } from '@/hooks/use-cart';
import { ProductProvider } from './product-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProductProvider>
          <CartProvider>
          {children}
          </CartProvider>
      </ProductProvider>
    </AuthProvider>
  );
}
