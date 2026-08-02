import type { NextConfig } from 'next';

/** Cap total workers and per-worker concurrency to the database read envelope. */
export const STATIC_GENERATION_LIMITS = {
  cpus: 1,
  staticGenerationMaxConcurrency: 1,
  staticGenerationMinPagesPerWorker: 1_600,
  staticGenerationRetryCount: 3,
} satisfies NonNullable<NextConfig['experimental']>;
