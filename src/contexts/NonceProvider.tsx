'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

interface NonceProviderProps {
  nonce?: string;
  children: ReactNode;
}

/**
 * Provides nonce to Framer Motion for CSP compliance.
 * Framer Motion 11.0.9+ supports nonces via MotionConfig.
 */
export function NonceProvider({ nonce, children }: NonceProviderProps) {
  return <MotionConfig nonce={nonce}>{children}</MotionConfig>;
}
