import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260901193000_add_merchant_wallet_funding.sql'
  ),
  'utf8'
);
describe('merchant wallet funding migration contract', () => {
  it('defines protected request and account tables', () => {
    expect(sql).toMatch(/merchant_wallet_funding_account_requests/);
    expect(sql).toMatch(/merchant_wallet_payment_accounts/);
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.merchant_wallet_payment_accounts/
    );
    expect(sql).toMatch(/status.*active.*pending.*disabled/s);
  });
  it('defines service-only assignment and idempotent credit RPCs', () => {
    expect(sql).toMatch(/persist_merchant_wallet_payment_account/);
    expect(sql).toMatch(/credit_merchant_wallet_funding/);
    expect(sql).toMatch(/merchant_wallet_topup/);
    expect(sql).toMatch(/p_reference/);
    expect(sql).toMatch(
      /total_earned = public\.merchant_wallets\.total_earned/s
    );
    expect(sql).toMatch(/auth\.role\(\).*service_role/s);
    expect(sql).toMatch(/SELECT id INTO STRICT v_account_id[\s\S]*FOR UPDATE/);
    expect(sql).toMatch(/merchant_wallet_account_mismatch/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.credit_merchant_wallet_funding/
    );
  });
});
