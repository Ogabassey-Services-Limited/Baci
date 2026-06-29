import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(currentDir, '../../../../../supabase/migrations');
const migrationFile = readdirSync(migrationsDir).find((fileName) =>
  fileName.endsWith('_add_receipt_claim_channel_tracking.sql')
);
const migrationSql = migrationFile
  ? readFileSync(join(migrationsDir, migrationFile), 'utf8')
  : '';

describe('receipt claim channel tracking migration', () => {
  it('adds source attribution and app-download counters to receipt claims', () => {
    expect(migrationFile).toBeDefined();
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS first_click_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS last_click_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS first_login_started_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS last_login_started_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS claimed_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS app_download_click_count integer NOT NULL DEFAULT 0/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS first_app_download_clicked_at/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS last_app_download_clicked_at/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS first_app_download_source text/i
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS last_app_download_source text/i
    );
    expect(migrationSql).toMatch(/CHECK \(app_download_click_count >= 0\)/i);
    expect(migrationSql).toMatch(
      /CHECK \(app_download_click_count >= 0\) NOT VALID/i
    );
    expect(migrationSql).toMatch(/'web'[\s\S]*'app'[\s\S]*'unknown'/i);
    expect(migrationSql).toMatch(
      /'app_store'[\s\S]*'play_store'[\s\S]*'unknown'/i
    );
  });

  it('backfills legacy channel sources as web and keeps delivered claim links redeemable', () => {
    const redeemReceiptClaimV2Sql =
      migrationSql.match(
        /CREATE OR REPLACE FUNCTION private\.redeem_receipt_claim_v2\([\s\S]*?END;\s*\$\$/i
      )?.[0] ?? '';

    expect(migrationSql).toMatch(
      /UPDATE public\.receipt_claims\s+SET first_click_source = 'web'\s+WHERE first_clicked_at IS NOT NULL\s+AND first_click_source IS NULL/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.receipt_claims\s+SET first_login_started_source = 'web'\s+WHERE first_login_started_at IS NOT NULL\s+AND first_login_started_source IS NULL/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.receipt_claims\s+SET claimed_source = 'web'\s+WHERE claimed_at IS NOT NULL\s+AND claimed_source IS NULL/i
    );
    expect(redeemReceiptClaimV2Sql).toMatch(
      /FROM public\.receipt_claims AS rc\s+WHERE rc\.token_hash = p_token_hash\s+LIMIT 1\s+FOR UPDATE/i
    );
    expect(redeemReceiptClaimV2Sql).not.toMatch(
      /rc\.notification_sent_at\s+IS\s+NOT\s+NULL/i
    );
  });

  it('marks direct app redemptions as click activity for channel funnel stats', () => {
    const redeemReceiptClaimV2Sql =
      migrationSql.match(
        /CREATE OR REPLACE FUNCTION private\.redeem_receipt_claim_v2\([\s\S]*?END;\s*\$\$/i
      )?.[0] ?? '';

    expect(redeemReceiptClaimV2Sql).toMatch(
      /first_clicked_at = COALESCE\(first_clicked_at, now\(\)\)/i
    );
    expect(redeemReceiptClaimV2Sql).toMatch(/last_clicked_at = now\(\)/i);
    expect(redeemReceiptClaimV2Sql).toMatch(
      /first_click_source = CASE\s+WHEN first_clicked_at IS NULL THEN v_source/i
    );
    expect(redeemReceiptClaimV2Sql).toMatch(/last_click_source = v_source/i);
  });

  it('uses versioned source-aware RPCs to avoid overloaded PostgREST functions', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.record_receipt_claim_click_v2\(\s*p_token_hash text,\s*p_source text\s*\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_receipt_claim_click_v2\(\s*p_token_hash text,\s*p_source text\s*\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_receipt_claim_login_started_v2\(\s*p_token_hash text,\s*p_source text\s*\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_receipt_claim_app_download_clicked_v2\(\s*p_token_hash text,\s*p_source text\s*\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.redeem_receipt_claim_v2\(\s*p_token_hash text,\s*p_source text\s*\)[\s\S]*SECURITY INVOKER/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_receipt_claim_click_v2\(text, text\)[\s\S]*TO anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_receipt_claim_login_started_v2\(text, text\)[\s\S]*TO anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_receipt_claim_app_download_clicked_v2\(text, text\)[\s\S]*TO anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.redeem_receipt_claim_v2\(text, text\)[\s\S]*TO authenticated/i
    );
  });

  it('returns channel and app-download campaign stats for the migration dashboard', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_receipt_claim_campaign_stats\([\s\S]*SECURITY DEFINER/i
    );
    expect(migrationSql).toMatch(/'clickedWebCount'/i);
    expect(migrationSql).toMatch(/'clickedAppCount'/i);
    expect(migrationSql).toMatch(/'loginStartedWebCount'/i);
    expect(migrationSql).toMatch(/'loginStartedAppCount'/i);
    expect(migrationSql).toMatch(/'claimedWebCount'/i);
    expect(migrationSql).toMatch(/'claimedAppCount'/i);
    expect(migrationSql).toMatch(/'appDownloadClickedCount'/i);
    expect(migrationSql).toMatch(/'appDownloadClickCount'/i);
    expect(migrationSql).toMatch(/'claimedSource'/i);
    expect(migrationSql).toMatch(/'lastAppDownloadSource'/i);
  });
});
