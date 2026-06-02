import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  __dirname,
  '../../../../supabase/migrations/20260602124500_claim_vtu_customer_email_notification_attempt_keys.sql'
);

describe('VTU customer email notification migration', () => {
  it('creates the keyed claim RPC after existing VTU email migrations', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(migrationPath).toContain('20260602124500_');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_vtu_customer_email_notification_attempt'
    );
    expect(sql).toContain('p_attempt_key text');
    expect(sql).toContain('p_sent_key text');
  });

  it('migrates legacy token-ready email metadata to the token-specific sent flag', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('UPDATE public.vtu_transactions');
    expect(sql).toContain("type IN ('electricity', 'cable_tv', 'betting')");
    expect(sql).toContain("metadata ->> 'customerEmailNotificationSent'");
    expect(sql).toContain("metadata ->> 'voucherPin'");
    expect(sql).toContain('customerTokenEmailNotificationSent');
  });

  it('migrates legacy pending-token receipt metadata to the receipt sent flag', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      "metadata ->> 'customerPendingTokenEmailNotificationSent'"
    );
    expect(sql).toContain("'customerReceiptEmailNotificationAttempted', true");
    expect(sql).toContain("'customerReceiptEmailNotificationSent', true");
  });
});
