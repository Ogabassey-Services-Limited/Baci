'use client';

import type React from 'react';
import { V2SavedProvider } from './providers/v2-saved-context';
import {
  type V2ThemeMode,
  V2ThemeProvider,
} from './providers/v2-theme-context';

interface OgabasseyLayoutProvidersProps {
  children: React.ReactNode;
  initialTheme?: V2ThemeMode;
}

export function OgabasseyLayoutProviders({
  children,
  initialTheme,
}: OgabasseyLayoutProvidersProps) {
  return (
    <V2ThemeProvider initialTheme={initialTheme}>
      <V2SavedProvider>{children}</V2SavedProvider>
    </V2ThemeProvider>
  );
}
