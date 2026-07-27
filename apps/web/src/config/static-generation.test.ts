import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATIC_GENERATION_LIMITS } from './static-generation';

const STOREFRONT_READ_ENVELOPE = 3;
const RESERVED_BUILD_READS = 2;
const PAGES_REQUIRING_A_FOURTH_WORKER = 4_801;

async function simulateStorefrontPrerenders(
  workerCount: number,
  pagesPerWorker: number,
  baselineReads = 0
) {
  let activeReads = baselineReads;
  const readPage = async () => {
    activeReads += 1;
    try {
      if (activeReads > STOREFRONT_READ_ENVELOPE) {
        throw new Error('merchant_snapshot timeout');
      }
      await Promise.resolve();
    } finally {
      activeReads -= 1;
    }
  };

  await Promise.all(
    Array.from({ length: workerCount * pagesPerWorker }, readPage)
  );
}

function configuredStaticWorkerCount(totalPages: number) {
  const configuredCpus =
    'cpus' in STATIC_GENERATION_LIMITS
      ? STATIC_GENERATION_LIMITS.cpus
      : Number.POSITIVE_INFINITY;

  return Math.min(
    configuredCpus,
    Math.ceil(
      totalPages / STATIC_GENERATION_LIMITS.staticGenerationMinPagesPerWorker
    )
  );
}

describe('STATIC_GENERATION_LIMITS', () => {
  it('activates the shared public-read gate only for production builds', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts?: { build?: string } };

    expect(packageJson.scripts?.build).toBe(
      'BACI_STOREFRONT_BUILD_READS=serialized NODE_ENV=production next build'
    );
  });

  it('bounds build pressure and retries transient page failures', () => {
    expect(STATIC_GENERATION_LIMITS).toEqual({
      cpus: STOREFRONT_READ_ENVELOPE - RESERVED_BUILD_READS,
      staticGenerationMaxConcurrency: 1,
      staticGenerationMinPagesPerWorker: 1_600,
      staticGenerationRetryCount: 3,
    });
  });

  it('caps total storefront reads when the page set would allocate a fourth worker', async () => {
    await expect(
      simulateStorefrontPrerenders(
        STOREFRONT_READ_ENVELOPE,
        1,
        RESERVED_BUILD_READS
      )
    ).rejects.toThrow('merchant_snapshot timeout');

    const workerCount = configuredStaticWorkerCount(
      PAGES_REQUIRING_A_FOURTH_WORKER
    );
    await expect(
      simulateStorefrontPrerenders(
        workerCount,
        STATIC_GENERATION_LIMITS.staticGenerationMaxConcurrency,
        RESERVED_BUILD_READS
      )
    ).resolves.toBeUndefined();
  });
});
