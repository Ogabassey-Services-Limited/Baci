'use client';

import { ThemeProvider } from 'next-themes';
import { CartProvider } from '@/hooks/use-cart';
import { AuthProvider } from './auth-context';
import { useNonce } from './NonceProvider';

export function Providers({
  children,
  forcedTheme,
}: {
  children: React.ReactNode;
  /** Force a specific theme (e.g., 'light' for storefronts to prevent dark mode flash) */
  forcedTheme?: string;
}) {
  const { nonce } = useNonce();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
      {...(forcedTheme ? { forcedTheme } : {})}
    >
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
