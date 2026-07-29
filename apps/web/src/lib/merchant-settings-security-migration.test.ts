import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationFiles = [
  '20260729195913_guard_merchant_identity_updates.sql',
  '20260729195914_update_merchant_identity_settings.sql',
  '20260729195915_guard_merchant_social_media.sql',
];
const migrationSql = migrationFiles
  .map((filename) =>
    readFileSync(
      resolve(process.cwd(), '../../supabase/migrations', filename),
      'utf8'
    )
  )
  .join('\n');

describe('merchant identity settings security migration', () => {
  it('keeps each ordered migration within the modularity limit', () => {
    for (const filename of migrationFiles) {
      const sql = readFileSync(
        resolve(process.cwd(), '../../supabase/migrations', filename),
        'utf8'
      );
      expect(sql.split('\n').length, filename).toBeLessThanOrEqual(300);
    }
  });

  it('rejects revoked and stale sessions at the database write boundary', () => {
    expect(migrationSql).toContain("v_jwt ->> 'session_id'");
    expect(migrationSql).toContain('FROM auth.sessions');
    expect(migrationSql).toContain("v_jwt ->> 'aal'");
    expect(migrationSql).toContain("v_jwt -> 'amr'");
    expect(migrationSql).toContain(
      'merchant_settings_reauthentication_required'
    );
  });

  it('blocks direct sensitive-column updates and permits only guarded RPCs', () => {
    expect(migrationSql).toContain('guard_merchant_identity_updates');
    expect(migrationSql).toContain('merchant_sensitive_update_not_authorized');
    expect(migrationSql).toContain('update_merchant_identity_settings');
    expect(migrationSql).toContain('update_merchant_social_media');
    expect(migrationSql).not.toContain(
      "current_user IN ('postgres', 'service_role')"
    );
    expect(migrationSql).toContain('FOR UPDATE');
  });

  it('records old and new sensitive values in the existing audit trail', () => {
    expect(migrationSql).toContain('INSERT INTO public.audit_logs');
    expect(migrationSql).toContain("'before'");
    expect(migrationSql).toContain("'after'");
    expect(migrationSql).toContain("'merchant_identity_settings_updated'");
    expect(migrationSql).toContain("'merchant_social_media_updated'");
    expect(migrationSql).toContain("'actor'");
  });

  it('requires optimistic concurrency for every identity update', () => {
    expect(migrationSql).toContain(
      'merchant_settings_concurrency_token_required'
    );
    expect(migrationSql).toContain('m.updated_at = p_expected_updated_at');
    expect(migrationSql).not.toContain(
      'p_expected_updated_at IS NULL\n       OR'
    );
  });

  it('keeps privileged functions unavailable to public and anonymous callers', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.update_merchant_identity_settings'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.update_merchant_social_media'
    );
    expect(migrationSql).toContain('FROM PUBLIC, anon');
  });
});
