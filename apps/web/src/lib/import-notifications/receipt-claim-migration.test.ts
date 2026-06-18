import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260618200719_receipt_claims_for_import_notifications.sql'
  ),
  'utf8'
);

describe('receipt claim migration', () => {
  it('creates receipt claim tables without storing raw claim tokens', () => {
    expect(migrationSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.receipt_claims/i
    );
    expect(migrationSql).toMatch(/token_hash text NOT NULL/i);
    expect(migrationSql).not.toMatch(/\btoken text\b/i);
    expect(migrationSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.receipt_claim_orders/i
    );
    expect(migrationSql).toMatch(/PRIMARY KEY \(receipt_claim_id, order_id\)/i);
  });

  it('enables RLS and keeps browser roles from direct table access', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.receipt_claims ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.receipt_claim_orders ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSql).toMatch(
      /CREATE POLICY receipt_claims_service_role_all[\s\S]*ON public\.receipt_claims[\s\S]*TO service_role/i
    );
    expect(migrationSql).toMatch(
      /CREATE POLICY receipt_claim_orders_service_role_all[\s\S]*ON public\.receipt_claim_orders[\s\S]*TO service_role/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.receipt_claims FROM anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.receipt_claim_orders FROM anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.receipt_claims TO service_role/i
    );
    expect(migrationSql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.receipt_claim_orders TO service_role/i
    );
  });

  it('adds idempotency and lookup indexes for job email and token hash', () => {
    expect(migrationSql).toMatch(
      /UNIQUE \(import_job_id, customer_email_normalized\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_claims_token_hash/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_receipt_claims_claimed_by_user_id[\s\S]*WHERE claimed_by_user_id IS NOT NULL/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_receipt_claims_expires_at[\s\S]*WHERE claimed_at IS NULL/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_receipt_claim_orders_order_id/i
    );
  });

  it('exposes receipt claim preview and redemption through scoped RPCs', () => {
    expect(migrationSql).toMatch(/CREATE SCHEMA IF NOT EXISTS private/i);
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.preview_receipt_claim\(p_token_hash text\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.preview_receipt_claim\(p_token_hash text\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.preview_receipt_claim\(text\)[\s\S]*TO anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.redeem_receipt_claim\(p_token_hash text\)[\s\S]*SECURITY DEFINER[\s\S]*auth\.uid\(\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.redeem_receipt_claim\(p_token_hash text\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.redeem_receipt_claim\(text\)[\s\S]*TO authenticated/i
    );
  });
});
