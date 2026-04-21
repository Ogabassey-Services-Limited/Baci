'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { useNonce } from '@/contexts/NonceProvider';

export function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  const { nonce } = useNonce();

  return (
    <ThemeProvider
      attribute="class"
      disableTransitionOnChange
      forcedTheme="light"
      nonce={nonce}
    >
      {children}
    </ThemeProvider>
  );
}
