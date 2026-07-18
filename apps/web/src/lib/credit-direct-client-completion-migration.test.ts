import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const migrationPaths = [
  '../../../../supabase/migrations/20260718070000_credit_direct_missing_confirmation_review.sql',
  '../../../../supabase/migrations/20260718070001_record_credit_direct_client_completion.sql',
  '../../../../supabase/migrations/20260718070002_bound_credit_direct_pending_cleanup.sql',
  '../../../../supabase/migrations/20260718070003_allow_credit_direct_tracking_token_with_session.sql',
  '../../../../supabase/migrations/20260718070004_validate_credit_direct_review_issue.sql',
  '../../../../supabase/migrations/20260718070005_backfill_credit_direct_missing_confirmation_review.sql',
  '../../../../supabase/migrations/20260718070006_harden_credit_direct_client_completion.sql',
  '../../../../supabase/migrations/20260718070007_supersede_credit_direct_completed_references.sql',
  '../../../../supabase/migrations/20260718070008_preserve_credit_direct_payment_audit_notes.sql',
  '../../../../supabase/migrations/20260718070009_scope_credit_direct_payment_audit_notes.sql',
  '../../../../supabase/migrations/20260718070010_preserve_credit_direct_provider_reference.sql',
].map((migrationPath) =>
  join(dirname(fileURLToPath(import.meta.url)), migrationPath)
);

describe('Credit Direct missing-confirmation reconciliation migration', () => {
  let reviewSql: string;
  let completionSql: string;
  let cleanupSql: string;
  let completionAuthCorrectionSql: string;
  let reviewValidationSql: string;
  let reviewBackfillSql: string;
  let completionHardeningSql: string;
  let completedReferenceSupersessionSql: string;
  let paymentAuditPreservationSql: string;
  let paymentAuditScopeSql: string;
  let paymentAuditProviderReferenceSql: string;

  beforeAll(() => {
    [
      reviewSql,
      completionSql,
      cleanupSql,
      completionAuthCorrectionSql,
      reviewValidationSql,
      reviewBackfillSql,
      completionHardeningSql,
      completedReferenceSupersessionSql,
      paymentAuditPreservationSql,
      paymentAuditScopeSql,
      paymentAuditProviderReferenceSql,
    ] = migrationPaths.map((migrationPath) =>
      readFileSync(migrationPath, 'utf8')
    );
  });

  it('keeps each ordered migration within the 300-line migration limit', () => {
    for (const [index, migrationSql] of [
      reviewSql,
      completionSql,
      cleanupSql,
      completionAuthCorrectionSql,
      reviewValidationSql,
      reviewBackfillSql,
      completionHardeningSql,
      completedReferenceSupersessionSql,
      paymentAuditPreservationSql,
      paymentAuditScopeSql,
      paymentAuditProviderReferenceSql,
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
    expect(reviewSql).toMatch(/NOT\s+VALID/i);
    expect(reviewSql).not.toMatch(/VALIDATE\s+CONSTRAINT/i);
    expect(reviewValidationSql).toMatch(/VALIDATE\s+CONSTRAINT/i);
    expect(reviewValidationSql).not.toMatch(/INSERT\s+INTO/i);
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

  it('requires the active signed session and skips unchanged callbacks', () => {
    expect(completionHardeningSql).toMatch(
      /v_active_session\s+IS\s+NULL[\s\S]*p_session_id\s+IS\s+NULL[\s\S]*p_session_id\s+IS\s+DISTINCT\s+FROM\s+v_active_session/i
    );
    expect(completionHardeningSql).toContain('v_completion_unchanged');
    expect(completionHardeningSql).toMatch(
      /p_email\s+IS\s+NOT\s+NULL[\s\S]*lower\(p_email\)\s*=\s*lower\(trim\(v_order\.customer_email\)\)/i
    );
    expect(completionHardeningSql).toMatch(
      /IF v_completion_unchanged[\s\S]*RETURN jsonb_build_object\('status', 'pending_confirmation'\);/i
    );
    expect(completionHardeningSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.record_credit_direct_client_completion_v1[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i
    );
    expect(completionHardeningSql).toMatch(
      /record_credit_direct_client_completion_v1\([\s\S]*CASE[\s\S]*p_email\s+IS\s+NOT\s+NULL[\s\S]*lower\(p_email\)\s*=\s*lower\(trim\(v_order\.customer_email\)\)[\s\S]*THEN\s+v_order\.tracking_token[\s\S]*ELSE\s+p_tracking_token[\s\S]*END/i
    );
  });

  it('supersedes SDK-only completion references before signing a retry', () => {
    expect(completedReferenceSupersessionSql).toContain(
      'creditDirectClientCompletedTransactionId'
    );
    expect(completedReferenceSupersessionSql).toContain(
      'creditDirectClientCompletedSessionId'
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /v_completed_txn[\s\S]*COALESCE\(v_completed_session,\s*v_prev_session\)[\s\S]*IS\s+DISTINCT\s+FROM\s+p_session_id[\s\S]*v_superseded\s*:=\s*v_superseded\s*\|\|\s*to_jsonb\(v_completed_txn\)/i
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /v_completed_session[\s\S]*v_completed_session\s*<>\s*p_session_id[\s\S]*v_superseded\s*:=\s*v_superseded\s*\|\|\s*to_jsonb\(v_completed_session\)/i
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /jsonb_array_length\(v_superseded\)\s*>\s*8[\s\S]*LIMIT\s+8/i
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /p_session_id\s*:=\s*NULLIF[\s\S]*RAISE EXCEPTION 'session_id_required'/i
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /p_signed_amount\s+IS\s+NULL\s+OR\s+p_signed_amount\s*<=\s*0[\s\S]*RAISE EXCEPTION 'signed_amount_required'/i
    );
    expect(
      completedReferenceSupersessionSql.indexOf('signed_amount_required')
    ).toBeLessThan(completedReferenceSupersessionSql.indexOf('SELECT notes'));
    expect(completedReferenceSupersessionSql).toMatch(
      /jsonb_typeof\(v_notes\)\s*<>\s*'object'[\s\S]*v_notes\s*:=\s*'\{\}'::jsonb/i
    );
    expect(completedReferenceSupersessionSql).toMatch(
      /v_prev_txn\s*:=\s*COALESCE\(\s*NULLIF\(trim\(v_notes->>'creditDirectTransactionId'\),\s*''\),\s*NULLIF\(trim\(v_notes->>'credit_directTransactionId'\),\s*''\)\s*\)/i
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
    expect(reviewBackfillSql).toMatch(
      /INSERT\s+INTO\s+public\.reconciliation_review[\s\S]*SELECT[\s\S]*FROM\s+public\.orders/i
    );
    expect(reviewBackfillSql).toContain('creditDirectTransactionId');
    expect(reviewBackfillSql).toContain('credit_directTransactionId');
    expect(reviewBackfillSql).toMatch(
      /COALESCE\([\s\S]*NULLIF\([\s\S]*creditDirectTransactionId[\s\S]*NULLIF\([\s\S]*credit_directTransactionId/i
    );
    expect(reviewBackfillSql).toMatch(
      /payment_status\s+IN\s*\([\s\S]*'bnpl_pending'[\s\S]*'bnpl_approved'/i
    );
    expect(reviewBackfillSql).not.toMatch(
      /updated_at\s*<\s*\(now\(\)\s*-\s*interval/i
    );
    expect(reviewBackfillSql).toMatch(/ON\s+CONFLICT[\s\S]*DO\s+NOTHING/i);
  });

  it('limits stale-session enforcement to transient provider webhook writes', () => {
    const verifiedWriteAssignment = paymentAuditScopeSql.match(
      /v_is_verified_webhook_write\s*:=\s*[\s\S]*?;/i
    )?.[0];
    const provenanceGate = paymentAuditScopeSql.match(
      /IF NOT v_is_verified_webhook_write[\s\S]*?RETURN NEW;\s+END IF;/i
    )?.[0];

    expect(verifiedWriteAssignment).toBeDefined();
    expect(provenanceGate).toBeDefined();
    expect(verifiedWriteAssignment).toMatch(
      /auth\.role\(\)\s+IS\s+NOT\s+DISTINCT\s+FROM\s+'service_role'/i
    );
    expect(verifiedWriteAssignment).toMatch(
      /\(v_new_notes->>'creditDirectVerifiedWebhookWrite'\)\s+IS\s+NOT\s+DISTINCT\s+FROM\s+'true'/i
    );
    expect(paymentAuditScopeSql).toMatch(
      /v_new_notes\s*:=\s*v_new_notes\s*-\s*'creditDirectVerifiedWebhookWrite'/i
    );
    expect(provenanceGate).toContain('creditDirectClientCompletionStatus');
    expect(provenanceGate).toContain('creditDirectProviderConfirmedAt');
    expect(provenanceGate).toContain('creditDirectTransactionId');
    expect(paymentAuditScopeSql.indexOf(provenanceGate as string)).toBeLessThan(
      paymentAuditScopeSql.indexOf('stale_credit_direct_session')
    );
  });

  it('keeps the verified provider reference while preserving concurrent evidence', () => {
    const mergeAssignment = paymentAuditProviderReferenceSql.match(
      /v_merged_notes\s*:=\s*\([\s\S]*?\)\s*\|\|\s*v_new_notes;/i
    )?.[0];
    const preservedKeyLoop = paymentAuditProviderReferenceSql.match(
      /FOREACH v_key IN ARRAY ARRAY\[[\s\S]*?END LOOP;/i
    )?.[0];

    expect(mergeAssignment).toContain("- 'creditDirectTransactionId'");
    expect(mergeAssignment).toContain("- 'credit_directTransactionId'");
    expect(preservedKeyLoop).not.toContain("'creditDirectTransactionId'");
    expect(preservedKeyLoop).not.toContain("'credit_directTransactionId'");
  });
});
