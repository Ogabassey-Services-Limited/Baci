import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase/migrations/20260804100000_quiz_universal_deadlines_v2.sql'
);
const sql = readFileSync(migrationPath, 'utf8');

describe('quiz universal deadline v2 migration', () => {
  it('stores a validated universal window and configurable question timer', () => {
    expect(sql).toMatch(/question_count BETWEEN 1 AND 50/i);
    expect(sql).toMatch(/time_per_question_seconds BETWEEN 5 AND 60/i);
    expect(sql).toMatch(
      /maximum_play_seconds = question_count \* time_per_question_seconds/i
    );
    expect(sql).toMatch(/live_window_seconds = pg_catalog\.floor/i);
    expect(sql).toMatch(/mode = 'live' AND max_attempts = 1/i);
  });

  it('caps each effective question deadline at the event end', () => {
    expect(sql).toMatch(
      /FUNCTION public\.quiz_effective_question_deadline_v2/i
    );
    expect(sql).toMatch(
      /LEAST\(\s*p_event_ends_at,\s*p_issued_at \+ pg_catalog\.make_interval/i
    );
    expect(sql).toMatch(/p_now >= v_event\.ends_at/i);
    expect(sql).toMatch(/v_now >= v_deadline/i);
  });

  it('locks events before attempts and uses the database clock', () => {
    const startCore = sql.match(
      /CREATE OR REPLACE FUNCTION private\.start_quiz_attempt_v2_core[\s\S]*?\n\$\$;/i
    )?.[0];
    expect(startCore).toBeDefined();
    if (!startCore) throw new Error('start core function is missing');
    expect(startCore).toMatch(/v_now timestamptz;/i);
    expect(startCore).toMatch(
      /FOR UPDATE;[\s\S]*v_now := pg_catalog\.clock_timestamp\(\)/i
    );
    expect(startCore.indexOf('FOR UPDATE;')).toBeLessThan(
      startCore.indexOf('FOR UPDATE;', startCore.indexOf('FOR UPDATE;') + 1)
    );
    expect(sql).not.toMatch(/p_client_answered_at\s*[<>]=?\s*/i);
  });

  it('makes starts idempotent and resumes one active attempt', () => {
    expect(sql).toMatch(/attempt\.start_request_id = p_start_request_id/i);
    expect(sql).toMatch(/attempt\.status = 'started'/i);
    expect(sql).toMatch(/jsonb_build_object\('resumed', true\)/i);
    expect(sql).toMatch(/attempt\.status <> 'test_reset'/i);
    expect(sql).toMatch(/option_order/i);
  });

  it('fails live device binding closed while retaining test diagnostics', () => {
    expect(sql).toMatch(/IF v_event_mode = 'live' THEN[\s\S]*QZ044/i);
    expect(sql).toMatch(/binding_temporarily_unavailable/i);
    expect(sql).toMatch(/quiz_device_binding_required/i);
    expect(sql).toMatch(/quiz_device_limit_reached/i);
  });

  it('returns playable state without score, correctness, or answer keys', () => {
    const stateFunction = sql.match(
      /CREATE OR REPLACE FUNCTION private\.quiz_attempt_state_v2[\s\S]*?\n\$\$;/i
    )?.[0];
    expect(stateFunction).toBeDefined();
    if (!stateFunction) throw new Error('attempt state function is missing');
    expect(stateFunction).not.toMatch(/'score'|'correct'|'answerKey'/i);
    expect(stateFunction).toMatch(/'eventEndsAt', v_event\.ends_at/i);
    expect(stateFunction).toMatch(/'deadlineAt', v_deadline/i);
  });

  it('classifies resumed terminal state without labeling it active', () => {
    const resumeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.resume_quiz_attempt_v2[\s\S]*?\n\$\$;/i
    )?.[0];
    expect(resumeFunction).toBeDefined();
    expect(resumeFunction).toMatch(/WHEN 'in_progress' THEN[\s\S]*'active'/i);
    expect(resumeFunction).toMatch(
      /WHEN 'event_cancelled' THEN[\s\S]*'cancelled'/i
    );
    expect(resumeFunction).toMatch(/ELSE[\s\S]*'pending_results'/i);
  });
});
