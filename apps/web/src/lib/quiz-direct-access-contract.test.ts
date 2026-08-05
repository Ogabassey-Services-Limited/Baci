import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase/migrations/20260804090000_quiz_live_event_foundation.sql'
);
const sql = readFileSync(migrationPath, 'utf8');

describe('quiz v2 direct-access contract', () => {
  it('removes compliance fields from authenticated direct reads', () => {
    expect(sql).toMatch(
      /REVOKE SELECT \(nlrc_permit_ref, compliance_verified\)/i
    );
    expect(sql).not.toMatch(
      /GRANT[\s\S]{0,80}nlrc_permit_ref[\s\S]{0,80}authenticated/i
    );
  });

  it('replaces legacy permissive policies instead of adding an OR path', () => {
    for (const policy of [
      'quiz_events_authenticated_select',
      'quiz_slots_authenticated_select',
      'quiz_variants_authenticated_select',
      'quiz_attempts_customer_read',
      'quiz_attempt_questions_customer_read',
      'quiz_attempt_answers_customer_read',
      'quiz_awards_customer_read',
      'leaderboard_refresh_log_client_read',
    ]) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS ${policy}`, 'i'));
    }
  });

  it('keeps direct player rows on contract v1 until safe v2 RPCs exist', () => {
    expect(
      sql.match(/e\.contract_version = 1/gi)?.length
    ).toBeGreaterThanOrEqual(7);
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.quiz_event_testers, public\.quiz_test_invites/i
    );
  });
});
