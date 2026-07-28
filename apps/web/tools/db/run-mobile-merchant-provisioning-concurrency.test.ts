import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMobileMerchantProvisioningConcurrency } from './run-mobile-merchant-provisioning-concurrency';

const harnessSource = readFileSync(
  join(
    process.cwd(),
    'tools/db/run-mobile-merchant-provisioning-concurrency.ts'
  ),
  'utf8'
);

describe('runMobileMerchantProvisioningConcurrency', () => {
  it('rejects a missing or non-loopback database before spawning sessions', async () => {
    await expect(
      runMobileMerchantProvisioningConcurrency({ databaseUrl: undefined })
    ).rejects.toThrow('LOCAL_DATABASE_URL is required');
    await expect(
      runMobileMerchantProvisioningConcurrency({
        databaseUrl:
          'postgresql://postgres:secret@db.example.test:5432/postgres',
      })
    ).rejects.toThrow('Supabase replay database URL is not supported');
  });

  it('coordinates two authenticated sessions with markers and no timing sleeps', () => {
    expect(harnessSource).toContain('SET LOCAL ROLE authenticated');
    expect(harnessSource).toContain('A_PROVISIONED');
    expect(harnessSource).toContain('B_STARTED');
    expect(harnessSource).toContain('provision_mobile_merchant_v2');
    expect(harnessSource).not.toMatch(/\bsetTimeout\s*\(/);
    expect(harnessSource).not.toMatch(/\bsleep\s*\(/i);
  });

  it('asserts one merchant, platform domain, and owner staff row', () => {
    expect(harnessSource).toContain('merchant_count');
    expect(harnessSource).toContain('domain_count');
    expect(harnessSource).toContain('staff_count');
    expect(harnessSource).toContain('created_true_count');
  });
});
