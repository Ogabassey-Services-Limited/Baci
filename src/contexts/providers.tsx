'use client';

import { ThemeProvider } from 'next-themes';
import { CartProvider } from '@/hooks/use-cart';
import { AuthProvider } from './auth-context';

/**
 * Root providers - only includes providers needed globally.
 * ProductProvider has been moved to /dashboard layout only to reduce
 * client-side JavaScript on public pages (landing, storefronts).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
