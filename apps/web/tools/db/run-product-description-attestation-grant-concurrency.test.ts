import { describe, expect, it } from 'vitest';
import { runProductDescriptionAttestationGrantConcurrency } from './run-product-description-attestation-grant-concurrency';

describe('runProductDescriptionAttestationGrantConcurrency', () => {
  it('rejects absent and non-disposable database URLs before creating sessions', async () => {
    await expect(
      runProductDescriptionAttestationGrantConcurrency()
    ).rejects.toThrow('LOCAL_DATABASE_URL is required');
    await expect(
      runProductDescriptionAttestationGrantConcurrency({
        databaseUrl:
          'postgresql://postgres:secret@db.example.test:5432/postgres',
      })
    ).rejects.toThrow('Supabase replay database URL is not supported');
  });
});
