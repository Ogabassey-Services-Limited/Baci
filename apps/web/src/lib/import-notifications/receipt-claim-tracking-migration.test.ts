import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260627090131_add_receipt_claim_tracking.sql'
  ),
  'utf8'
);

describe('receipt claim tracking migration', () => {
  it('adds click and login-start counters to receipt claims', () => {
    expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS first_clicked_at/i);
    expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS last_clicked_at/i);
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS first_login_started_at/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS last_login_started_at/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS login_started_count integer NOT NULL DEFAULT 0/i
    );
    expect(migrationSql).toMatch(/CHECK \(click_count >= 0\)/i);
    expect(migrationSql).toMatch(/CHECK \(login_started_count >= 0\)/i);
  });

  it('records recipient activity through token-scoped RPCs only', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.record_receipt_claim_click\([\s\S]*SECURITY DEFINER/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.receipt_claims[\s\S]*WHERE token_hash = p_token_hash[\s\S]*AND notification_sent_at IS NOT NULL[\s\S]*AND expires_at > now\(\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_receipt_claim_click\([\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_receipt_claim_login_started\([\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_receipt_claim_click\(text\)[\s\S]*TO anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_receipt_claim_login_started\(text\)[\s\S]*TO anon, authenticated/i
    );
  });

  it('exposes merchant-authorized campaign stats without direct table grants', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_receipt_claim_campaign_stats\([\s\S]*SECURITY DEFINER/i
    );
    expect(migrationSql).toMatch(
      /public\.check_staff_permission\([\s\S]*'orders'[\s\S]*'view'/i
    );
    expect(migrationSql).toMatch(
      /FROM public\.receipt_claims AS rc[\s\S]*WHERE rc\.merchant_id = p_merchant_id[\s\S]*AND rc\.import_job_id = p_import_job_id/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_receipt_claim_campaign_stats\(uuid, uuid\)[\s\S]*FROM PUBLIC, anon/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_receipt_claim_campaign_stats\(uuid, uuid\)[\s\S]*TO authenticated, service_role/i
    );
    expect(migrationSql).not.toMatch(
      /GRANT SELECT[\s\S]*ON TABLE public\.receipt_claims[\s\S]*TO authenticated/i
    );
  });
});
