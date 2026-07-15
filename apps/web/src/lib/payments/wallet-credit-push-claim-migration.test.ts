import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260714225500_release_wallet_credit_push.sql'
  ),
  'utf8'
);

describe('wallet credit push claim migration', () => {
  it('stores a unique ownership token with each claim', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_wallet_credit_push_v2('
    );
    expect(migrationSql).toContain(
      "'wallet_credit_push_claim_token', p_claim_token"
    );
    expect(migrationSql).toContain(
      "p_allow_initial_claim OR COALESCE(metadata, '{}'::jsonb)"
    );
    expect(migrationSql).toContain("? 'wallet_credit_push_retryable_at'");
  });

  it('only releases the marker owned by the current attempt', () => {
    expect(migrationSql).toContain(
      "->> 'wallet_credit_push_claim_token' = p_claim_token"
    );
    expect(migrationSql).toContain(
      "'wallet_credit_push_retryable_at', statement_timestamp()"
    );
  });

  it('guards both functions with a null-safe service-role check', () => {
    expect(
      migrationSql.match(
        /IF \(SELECT auth\.role\(\)\) IS DISTINCT FROM 'service_role' THEN/g
      )
    ).toHaveLength(2);
    expect(migrationSql.match(/SET search_path = ''/g)).toHaveLength(2);
  });

  it('revokes public access and grants only service_role', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text, boolean) FROM PUBLIC;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text, boolean) FROM anon;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text, boolean) FROM authenticated;'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text, boolean) TO service_role;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM PUBLIC;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM anon;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM authenticated;'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.release_wallet_credit_push(uuid, text) TO service_role;'
    );
  });
});
