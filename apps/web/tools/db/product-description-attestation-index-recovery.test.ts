import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  join(
    import.meta.dirname,
    '../../../../supabase/migrations/20260801190000_recover_product_description_attestation_indexes.sql'
  ),
  'utf8'
);

const INDEXES = [
  'pd_attestation_grants_merchant_created_idx',
  'pd_attestation_evidence_merchant_created_idx',
] as const;

describe('product description attestation index recovery migration', () => {
  it('removes invalid same-name indexes before retrying concurrent builds', () => {
    expect(migrationSource).toContain('-- disable-transaction');

    for (const indexName of INDEXES) {
      expect(migrationSource).toContain(
        `AND index_class.relname = '${indexName}'`
      );
      expect(migrationSource).toContain('AND NOT index_state.indisvalid');
      expect(migrationSource).toContain(
        `DROP INDEX IF EXISTS private.${indexName}`
      );
      expect(migrationSource).toContain(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}`
      );

      const dropOffset = migrationSource.indexOf(
        `DROP INDEX IF EXISTS private.${indexName}`
      );
      const createOffset = migrationSource.indexOf(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}`
      );
      expect(dropOffset).toBeGreaterThan(-1);
      expect(createOffset).toBeGreaterThan(dropOffset);
    }
  });
});
