'use client';

import { ThemeProvider } from 'next-themes';
import { CartProvider } from '@/hooks/use-cart';
import { AuthProvider } from './auth-context';

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
