
'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './auth-context';
import { CartProvider } from '@/hooks/use-cart';
import { ProductProvider } from './product-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
