import { afterEach, describe, expect, it, vi } from 'vitest';
import { runProductDescriptionAttestationGrantConcurrency } from './run-product-description-attestation-grant-concurrency';

describe('runProductDescriptionAttestationGrantConcurrency', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an absent database URL before creating sessions', async () => {
    vi.stubEnv('LOCAL_DATABASE_URL', '');
    await expect(
      runProductDescriptionAttestationGrantConcurrency()
    ).rejects.toThrow('LOCAL_DATABASE_URL is required');
  });

  it('rejects a non-disposable database URL before creating sessions', async () => {
    await expect(
      runProductDescriptionAttestationGrantConcurrency({
        databaseUrl:
          'postgresql://postgres:secret@db.example.test:5432/postgres',
      })
    ).rejects.toThrow('Supabase replay database URL is not supported');
  });
});
