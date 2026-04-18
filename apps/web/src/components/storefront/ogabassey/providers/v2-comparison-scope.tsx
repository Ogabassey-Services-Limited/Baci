'use client';

import type React from 'react';
import { V2ComparisonProvider } from './v2-comparison-context';

interface V2ComparisonScopeProps {
  children: React.ReactNode;
}

export function V2ComparisonScope({ children }: V2ComparisonScopeProps) {
  return <V2ComparisonProvider>{children}</V2ComparisonProvider>;
}
