'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/auth-context';
import { NonceProvider, useNonce } from '@/contexts/NonceProvider';
import { CartProvider } from '@/hooks/use-cart';

interface ProvidersProps {
  children: React.ReactNode;
  nonce?: string;
  /** Force a specific theme (e.g., 'light' for storefronts to prevent dark mode flash) */
  forcedTheme?: string;
}

interface ProvidersContentProps {
  children: React.ReactNode;
  forcedTheme?: string;
}

export function Providers({ children, forcedTheme, nonce }: ProvidersProps) {
  return (
    <NonceProvider nonce={nonce}>
      <ProvidersContent forcedTheme={forcedTheme}>{children}</ProvidersContent>
    </NonceProvider>
  );
}

// Providers creates NonceProvider; ProvidersContent consumes it with useNonce().
// A single component cannot both create the provider and read that context.
function ProvidersContent({ children, forcedTheme }: ProvidersContentProps) {
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
