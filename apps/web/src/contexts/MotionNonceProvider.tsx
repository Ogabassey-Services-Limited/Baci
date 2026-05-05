'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { useNonce } from '@/contexts/NonceProvider';

interface MotionNonceProviderProps {
  children: ReactNode;
}

/**
 * Opt-in Framer Motion nonce wrapper for routes that actually render motion.
 */
export function MotionNonceProvider({ children }: MotionNonceProviderProps) {
  const { nonce } = useNonce();

  return <MotionConfig nonce={nonce}>{children}</MotionConfig>;
}
