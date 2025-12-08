'use client';

import { ThemeProvider } from 'next-themes';
import { CartProvider } from '@/hooks/use-cart';

/**
 * Minimal providers for preview/template pages.
 * Excludes AuthProvider and ProductProvider since preview pages
 * don't need authentication or product fetching from the API.
 */
export function PreviewProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CartProvider>{children}</CartProvider>
    </ThemeProvider>
  );
}
