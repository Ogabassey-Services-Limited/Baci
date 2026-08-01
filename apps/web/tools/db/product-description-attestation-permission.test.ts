import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  join(
    import.meta.dirname,
    '../../../../supabase/migrations/20260801210000_require_product_permission_for_attestation_grant.sql'
  ),
  'utf8'
);

describe('product description attestation permission migration', () => {
  it('checks product permissions before replay lookups can issue grants', () => {
    const permissionCheckIndex = migrationSource.indexOf(
      'public.check_staff_permission'
    );
    const replayLookupIndex = migrationSource.indexOf(
      'FROM private.product_description_attestation_grants AS attestation'
    );

    expect(permissionCheckIndex).toBeGreaterThanOrEqual(0);
    expect(permissionCheckIndex).toBeLessThan(replayLookupIndex);
    expect(migrationSource).toContain("'products'");
    expect(migrationSource).toContain("THEN 'edit'");
    expect(migrationSource).toContain("ELSE 'create'");
    expect(migrationSource).toContain('v_product_exists');
  });
});
