import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsRoot = path.resolve(
  import.meta.dirname,
  '../../../../../supabase/migrations'
);

describe('Jumia credential hardening migrations', () => {
  it('restores integrations.manage for direct lease and rotation RPCs', () => {
    const sql = readFileSync(
      path.join(
        migrationsRoot,
        '20260825000000_restore_jumia_manage_credential_rotation.sql'
      ),
      'utf8'
    );

    expect(sql).not.toMatch(/'integrations',\s*'view'/i);
    expect(sql.match(/'integrations',\s*'manage'/gi)).toHaveLength(2);
  });

  it('locks the provider shop before the disconnect purge locks rows', () => {
    const sql = readFileSync(
      path.join(
        migrationsRoot,
        '20260825000100_serialize_jumia_disconnect_purge.sql'
      ),
      'utf8'
    );

    expect(sql).toMatch(
      /pg_advisory_xact_lock[\s\S]*?p_merchant_id::text[\s\S]*?v_shop_id[\s\S]*?SELECT integration\.jumia_authorization_id[\s\S]*?FOR UPDATE/i
    );
  });
});
