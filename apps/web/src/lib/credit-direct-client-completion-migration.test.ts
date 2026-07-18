import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPaths = [
  '../../supabase/migrations/20260718070000_credit_direct_missing_confirmation_review.sql',
  '../../supabase/migrations/20260718070001_record_credit_direct_client_completion.sql',
  '../../supabase/migrations/20260718070002_bound_credit_direct_pending_cleanup.sql',
  '../../supabase/migrations/20260718070003_allow_credit_direct_tracking_token_with_session.sql',
].map((migrationPath) => join(process.cwd(), migrationPath));

describe('Credit Direct missing-confirmation reconciliation migration', () => {
  const [reviewSql, completionSql, cleanupSql, completionAuthCorrectionSql] =
    migrationPaths.map((migrationPath) => readFileSync(migrationPath, 'utf8'));

  it('keeps each ordered migration within the 300-line migration limit', () => {
    for (const [index, migrationSql] of [
      reviewSql,
      completionSql,
      cleanupSql,
      completionAuthCorrectionSql,
    ].entries()) {
      expect(
        migrationSql.trimEnd().split('\n').length,
        basename(migrationPaths[index] as string)
      ).toBeLessThanOrEqual(300);
    }
  });

  it('adds the durable review issue without weakening existing issue types', () => {
    expect(reviewSql).toContain('reconciliation_review_issue_type_check');
    expect(reviewSql).toContain('credit_direct_confirmation_missing');
    expect(reviewSql).toMatch(/VALIDATE\s+CONSTRAINT/i);
  });

  it('records SDK completion evidence without marking the order paid', () => {
    const completionFunction = completionSql.match(
      /CREATE OR REPLACE FUNCTION public\.record_credit_direct_client_completion[\s\S]*?\n\$\$;/
    )?.[0];
    const orderUpdate = completionFunction?.match(
      /UPDATE public\.orders[\s\S]*?WHERE id = v_order\.id;/
    )?.[0];

    expect(completionFunction).toBeDefined();
    expect(orderUpdate).toBeDefined();
    expect(completionSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.record_credit_direct_client_completion/i
    );
    expect(completionSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(completionSql).toMatch(/auth\.uid\(\)/i);
    expect(completionSql).toContain('creditDirectClientCompletedAt');
    expect(completionSql).toContain('creditDirectClientCompletionStatus');
    expect(completionFunction).toContain('provider_confirmed');
    expect(completionSql).toContain('creditDirectClientCompletedReference');
    expect(completionFunction).toContain('p_session_id');
    expect(completionFunction).toContain('v_is_first_completion');
    expect(completionFunction).toContain('v_completed_session');
    expect(completionFunction).toMatch(
      /p_session_id\s+IS\s+DISTINCT\s+FROM\s+v_completed_session/i
    );
    expect(orderUpdate).toMatch(
      /updated_at\s*=\s*CASE\s+WHEN\s+v_is_first_completion/i
    );
    expect(completionFunction).not.toMatch(
      /jsonb_build_object\([\s\S]{0,100}'creditDirectTransactionId'/i
    );
    expect(completionSql).toMatch(
      /INSERT\s+INTO\s+public\.reconciliation_review/i
    );
    expect(completionFunction).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i);
    expect(completionFunction).toMatch(
      /UPDATE\s+public\.reconciliation_review[\s\S]*credit_direct_confirmation_missing/i
    );
    expect(orderUpdate).not.toMatch(/payment_status\s*=/i);
    expect(completionSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_credit_direct_client_completion[\s\S]*TO\s+anon,\s*authenticated,\s*service_role/i
    );
  });

  it('treats a matching tracking token as authorization even when a session exists', () => {
    expect(completionAuthCorrectionSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_credit_direct_client_completion/
    );
    const authorizationBlock = completionAuthCorrectionSql.match(
      /IF v_request_role <> 'service_role' THEN[\s\S]*?RAISE EXCEPTION 'unauthorized';[\s\S]*?END IF;/
    )?.[0];

    expect(authorizationBlock).toBeDefined();
    expect(authorizationBlock).toMatch(
      /IF NOT \(\s*\(\s*p_tracking_token IS NOT NULL\s+AND trim\(p_tracking_token\) <> ''\s+AND p_tracking_token IS NOT DISTINCT FROM v_order\.tracking_token\s*\)\s+OR\s+\(\s*v_user_id IS NOT NULL\s+AND\s+\(\s*EXISTS \([\s\S]*?FROM public\.merchants[\s\S]*?OR EXISTS \([\s\S]*?FROM public\.staff_members[\s\S]*?OR EXISTS \([\s\S]*?FROM public\.customers[\s\S]*?\)\s*\)\s*\)\s*\) THEN\s+RAISE EXCEPTION 'unauthorized'/i
    );
    expect(authorizationBlock).not.toMatch(/v_user_id IS NULL/i);
    expect(authorizationBlock).not.toMatch(/p_session_id/i);
  });

  it('normalizes provider-reference collisions without hiding missing reviews', () => {
    expect(completionAuthCorrectionSql).toMatch(
      /BEGIN\s+UPDATE public\.reconciliation_review[\s\S]*?EXCEPTION\s+WHEN unique_violation THEN\s+RAISE EXCEPTION 'reference_mismatch';\s+END;[\s\S]*?IF NOT FOUND THEN\s+RAISE EXCEPTION 'reference_mismatch';\s+END IF;/i
    );
  });

  it('protects only open reviewed Credit Direct attempts from cleanup', () => {
    expect(cleanupSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.mark_abandoned_orders/i
    );
    expect(cleanupSql).toMatch(/o\.updated_at\s*</i);
    expect(cleanupSql).toMatch(/NOT\s+EXISTS/i);
    expect(cleanupSql).toContain('credit_direct_confirmation_missing');
    expect(cleanupSql).toMatch(/rr\.resolved_at\s+IS\s+NULL/i);
    expect(cleanupSql).toContain('credit_direct_sdk_on_success');
    expect(cleanupSql).toMatch(/interval\s+'14 days'/i);
    expect(cleanupSql).toMatch(
      /metadata->>'client_completed_at'[\s\S]*interval\s+'14 days'/i
    );
    expect(cleanupSql).toMatch(
      /UPDATE\s+public\.reconciliation_review[\s\S]*resolved_at/i
    );
  });

  it('backfills reference-bearing Credit Direct orders already stuck before deployment', () => {
    expect(reviewSql).toMatch(
      /INSERT\s+INTO\s+public\.reconciliation_review[\s\S]*SELECT[\s\S]*FROM\s+public\.orders/i
    );
    expect(reviewSql).toContain('creditDirectTransactionId');
    expect(reviewSql).toContain('credit_directTransactionId');
    expect(reviewSql).toMatch(
      /payment_status\s+IN\s*\([\s\S]*'bnpl_pending'[\s\S]*'bnpl_approved'/i
    );
    expect(reviewSql).toMatch(/ON\s+CONFLICT[\s\S]*DO\s+NOTHING/i);
  });
});
