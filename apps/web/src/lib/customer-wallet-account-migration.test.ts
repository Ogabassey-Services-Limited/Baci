import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('multi-currency customer wallet migration', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      '../../supabase/migrations/20260711201000_customer_wallet_currency_accounts.sql'
    ),
    'utf8'
  );

  it('adds isolated currency accounts without changing the legacy NGN wallet key', () => {
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.customer_wallet_accounts'
    );
    expect(sql).toContain(
      "currency text NOT NULL CHECK (currency IN ('USDT'))"
    );
    expect(sql).not.toMatch(
      /ALTER TABLE public\.customer_wallets[\s\S]*ADD COLUMN.*currency/i
    );
  });

  it('keeps all currency-account writes service-role-only and idempotent', () => {
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON public.customer_wallet_accounts FROM authenticated'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.credit_customer_wallet_account'
    );
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('TO service_role;');
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]+TO authenticated/is);
  });

  it('pins the definer search path and rejects cross-merchant accounts', () => {
    expect(sql).toContain("SET search_path TO ''");
    expect(sql).not.toContain('SET search_path = public, pg_temp');
    expect(sql).toContain('Customer does not belong to merchant');
  });

  it('uses a named account uniqueness constraint to avoid output-column ambiguity', () => {
    expect(sql).toContain(
      'CONSTRAINT customer_wallet_accounts_owner_currency_key'
    );
    expect(sql).toContain(
      'ON CONFLICT ON CONSTRAINT customer_wallet_accounts_owner_currency_key'
    );
    expect(sql).not.toContain(
      'ON CONFLICT (customer_id, merchant_id, currency)'
    );
  });
});
