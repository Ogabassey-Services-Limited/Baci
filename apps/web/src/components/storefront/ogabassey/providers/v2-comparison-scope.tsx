'use client';

import type React from 'react';
import { V2ComparisonProvider } from './v2-comparison-context';

interface V2ComparisonScopeProps {
  children: React.ReactNode;
  storageNamespace?: string | null;
}

export function V2ComparisonScope({
  children,
  storageNamespace,
}: V2ComparisonScopeProps) {
  const providerKey = storageNamespace ?? 'default';

  return (
    <V2ComparisonProvider
      key={providerKey}
      storageNamespace={storageNamespace}
    >
      {children}
    </V2ComparisonProvider>
  );
}
