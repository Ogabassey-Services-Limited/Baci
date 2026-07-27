import type { NextConfig } from 'next';

/** Keep build-time storefront reads below the database's connection envelope. */
export const STATIC_GENERATION_LIMITS = {
  staticGenerationMaxConcurrency: 4,
  staticGenerationMinPagesPerWorker: 1_600,
  staticGenerationRetryCount: 3,
} satisfies NonNullable<NextConfig['experimental']>;
