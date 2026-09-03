import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260903214000_refresh_token_for_active_provider_submission.sql'
  ),
  'utf8'
);

describe('refresh token for active provider submission migration', () => {
  it('rotates the attempt token for non-stale provider_submitting charges', () => {
    expect(sql).toContain("v_existing.status = 'provider_submitting'");
    expect(sql).toContain(
      "attempt_token_digest = pg_catalog.encode(extensions.digest(p_attempt_token, 'sha256'), 'hex')"
    );
    expect(sql).toContain("'needs_reconciliation'");
    expect(sql).toContain('STALE_PROVIDER_SUBMISSION');
  });
});
