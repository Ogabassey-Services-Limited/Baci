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

  it('overrides the active-view experiment with manage-only credential RPCs', () => {
    const sql = readFileSync(
      path.join(
        migrationsRoot,
        '20260827100000_restore_jumia_manage_credential_rotation_after_view.sql'
      ),
      'utf8'
    );

    expect(sql).not.toMatch(/'integrations',\s*'view'/i);
    expect(sql.match(/'integrations',\s*'manage'/gi)).toHaveLength(2);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_jumia_authorization_refresh_lease/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.rotate_jumia_authorization_credentials/i
    );
  });

  it('rechecks self-authorization conflicts after acquiring OAuth shop locks', () => {
    const sql = readFileSync(
      path.join(
        migrationsRoot,
        '20260827100100_recheck_jumia_oauth_self_authorization_conflicts.sql'
      ),
      'utf8'
    );

    expect(sql).toMatch(
      /pg_advisory_xact_lock[\s\S]*?END LOOP;[\s\S]*?FROM jsonb_to_recordset\(p_integrations\) AS requested\(shop_id text\)[\s\S]*?connection_method = 'self_authorization'[\s\S]*?RAISE EXCEPTION 'Jumia shop is already connected through self-authorization'/i
    );
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

  it('detaches only the integration protected by the shop lock', () => {
    const sql = readFileSync(
      path.join(
        migrationsRoot,
        '20260825000200_scope_jumia_disconnect_purge_to_locked_shop.sql'
      ),
      'utf8'
    );

    expect(sql).toMatch(
      /UPDATE public\.marketplace_integrations[\s\S]*?WHERE integration\.id = p_integration_id[\s\S]*?IF EXISTS[\s\S]*?integration\.jumia_authorization_id = v_authorization_id/i
    );
  });
});
