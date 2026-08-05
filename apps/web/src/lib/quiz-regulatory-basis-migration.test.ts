import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260804123000_quiz_regulatory_basis_and_live_launch_v2.sql'
  ),
  'utf8'
);

describe('quiz regulatory basis migration', () => {
  it('keeps legacy permits while requiring an evidence-backed v2 live basis', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS regulatory_basis text');
    expect(sql).toContain('regulatory_jurisdiction text');
    expect(sql).toContain('regulatory_evidence_ref text');
    expect(sql).toContain("'free_skill_competition'");
    expect(sql).toContain("'state_permit'");
    expect(sql).toContain("'fccpc_registration'");
    expect(sql).toContain('quiz_events_v2_live_regulatory_readiness_check');
    expect(sql).toContain('compliance_verified IS TRUE');
    expect(sql).toContain('Deprecated legacy compatibility field');
    expect(sql).not.toMatch(/DROP\s+COLUMN\s+.*nlrc_permit_ref/i);
  });

  it('uses the regulatory helper for live finalization and keeps test events off the prize path', () => {
    const finalizer = sql.split(
      'CREATE OR REPLACE FUNCTION public.finalize_due_live_quiz_events_v2'
    )[1];
    expect(finalizer).toContain('quiz_live_prize_regulatory_ready_v2');
    expect(finalizer).not.toContain('nlrc_permit_ref');
    expect(finalizer).toContain("event.mode = 'live'");
    expect(finalizer).not.toContain(
      'WHERE id = v_event.id;\n      WHERE id = v_event.id;'
    );
  });

  it('routes list, start, and leaderboard live access through the new readiness gate', () => {
    const list = sql
      .split('CREATE OR REPLACE FUNCTION public.list_quiz_events_v2')[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard_public_v2'
      )[0];
    const leaderboard = sql
      .split(
        'CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard_public_v2'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.start_quiz_attempt_with_device_v2'
      )[0];
    const start = sql.split(
      'CREATE OR REPLACE FUNCTION public.start_quiz_attempt_with_device_v2'
    )[1];

    for (const runtimeGate of [list, leaderboard, start]) {
      expect(runtimeGate).toContain('quiz_live_prize_regulatory_ready_v2');
      expect(runtimeGate).not.toContain('nlrc_permit_ref');
    }
    expect(start).toContain('FOR UPDATE');
  });

  it('launches a verified owner draft with a row lock and atomic reservation', () => {
    const launch = sql
      .split('CREATE FUNCTION public.launch_quiz_event_v2')[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.finalize_due_live_quiz_events_v2'
      )[0];
    expect(launch).toContain('merchant.user_id = auth.uid()');
    expect(launch).toContain("v_event.status <> 'draft'");
    expect(launch).toContain('FOR UPDATE OF event');
    expect(launch).toContain('p_regulatory_basis text');
    expect(launch).toContain('p_regulatory_jurisdiction text');
    expect(launch).toContain('p_regulatory_evidence_ref text');
    expect(launch).toContain('compliance_verified = true');
    expect(launch).toContain('regulatory_evidence_ref = pg_catalog.btrim');
    expect(launch).toContain("p_rules_version IS DISTINCT FROM 'live-v1'");
    expect(launch).toContain("answer_key_reviewed' IS DISTINCT FROM 'true'");
    expect(launch).toContain('SELECT pg_catalog.count(*)');
    expect(launch).toContain(
      'p_question_count * p_time_per_question_seconds) + 120'
    );
    expect(launch).toContain('private.reserve_quiz_product_prize_v2');
    expect(launch).toContain("mode = 'live'");
    expect(launch).toContain("'contractVersion', 2");
    expect(launch).not.toContain('nlrc_permit_ref');
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.launch_quiz_event_v2[\s\S]*TO authenticated/i
    );
  });
});
