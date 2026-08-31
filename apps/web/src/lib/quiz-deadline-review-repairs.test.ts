import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(process.cwd(), '../../supabase/migrations');
const ciWorkflow = readFileSync(
  resolve(process.cwd(), '../../.github/workflows/ci.yml'),
  'utf8'
);
const migrations = readdirSync(migrationsDirectory).sort();
const readMigration = (file: string) =>
  readFileSync(resolve(migrationsDirectory, file), 'utf8');
const scorePublicationGateSql = readMigration(
  '20260830193441_quiz_instant_test_publication_score_gate_v2.sql'
);
const scorePublicationReadySql = readMigration(
  '20260830204001_quiz_instant_test_publication_score_gate_ready_v2.sql'
);
const deadlineControlRepairSql = [
  '20260831120000_quiz_instant_test_publication_retry_backoff_v2.sql',
  '20260831120100_quiz_instant_runtime_gate_commit_and_batch_v2.sql',
  '20260831120200_quiz_instant_live_backlog_index_health_v2.sql',
  '20260831120300_quiz_instant_retry_health_aggregation_v2.sql',
]
  .map(readMigration)
  .join('\n\n');
const retryPendingHealthSql = [
  '20260831120400_quiz_instant_test_retry_health_v2.sql',
  '20260831120500_quiz_instant_live_terminal_retry_health_v2.sql',
]
  .map(readMigration)
  .join('\n\n');
const wakeupAccessSql = readMigration(
  '20260831120600_quiz_results_wakeup_player_access_v2.sql'
);
const testPublicationControlRlsSql = readMigration(
  '20260831120700_quiz_test_publication_control_rls_v2.sql'
);

describe('quiz deadline review repairs', () => {
  it('keeps test publication closed until serialized score repair completes', () => {
    const indexOfMigration = (file: string) => {
      const index = migrations.indexOf(file);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(scorePublicationGateSql).toMatch(
      /BEFORE UPDATE OF results_published_at ON public\.quiz_events/i
    );
    expect(scorePublicationGateSql).toMatch(
      /NEW\.mode <> 'test'[\s\S]*?quiz_test_score_publication_not_ready/i
    );
    expect(scorePublicationReadySql).toMatch(
      /UPDATE private\.quiz_test_publication_control_v2[\s\S]*?SET score_repair_ready = true/i
    );
    expect(
      indexOfMigration(
        '20260830193441_quiz_instant_test_publication_score_gate_v2.sql'
      )
    ).toBeLessThan(
      indexOfMigration(
        '20260830193442_quiz_instant_deadline_publication_v2.sql'
      )
    );
    expect(
      indexOfMigration(
        '20260830204000_quiz_instant_score_serialization_repair_v2.sql'
      )
    ).toBeLessThan(
      indexOfMigration(
        '20260830204001_quiz_instant_test_publication_score_gate_ready_v2.sql'
      )
    );
  });

  it('backs off poison test-publication retries', () => {
    expect(deadlineControlRepairSql).toMatch(
      /test_result_publication_failed'[\s\S]*?updated_at <=[\s\S]*?interval '30 seconds'/i
    );
    expect(deadlineControlRepairSql).toMatch(
      /v_should_log_failure :=[\s\S]*?UPDATE public\.quiz_events[\s\S]*?updated_at = pg_catalog\.clock_timestamp\(\)[\s\S]*?WHERE id = v_event\.id;/i
    );
  });

  it('separates the committed runtime gate from deadline processing', () => {
    expect(deadlineControlRepairSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_quiz_runtime_control_v2\(/i
    );
    expect(deadlineControlRepairSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.process_due_quiz_deadlines_v2\([\s\S]*?FROM public\.quiz_runtime_control_v2 AS control/i
    );
    expect(deadlineControlRepairSql).not.toMatch(
      /process_due_quiz_deadlines_v2\([\s\S]*?INSERT INTO public\.quiz_runtime_control_v2/i
    );
  });

  it('keeps an approved in-flight batch valid without persisting its lease', () => {
    expect(deadlineControlRepairSql).toMatch(
      /set_config\([\s\S]*?'baci\.quiz_live_publication_batch_xid'/i
    );
    expect(deadlineControlRepairSql).toMatch(
      /current_setting\([\s\S]*?'baci\.quiz_live_publication_batch_xid'[\s\S]*?pg_current_xact_id/i
    );
  });

  it('indexes the unpublished live backlog and reports retry backoff', () => {
    expect(deadlineControlRepairSql).toMatch(
      /CREATE INDEX IF NOT EXISTS quiz_events_v2_live_unpublished_due_idx/i
    );
    expect(deadlineControlRepairSql).toMatch(
      /finalization_error_code = 'live_award_transfer_failed'[\s\S]*?updated_at >[\s\S]*?interval '30 seconds'/i
    );
    expect(deadlineControlRepairSql).toContain("'liveAwardRetryPending'");
    expect(deadlineControlRepairSql).toMatch(
      /v_failed :=[\s\S]*?liveAwardRetryPending/i
    );
  });

  it('keeps backed-off publication and terminalization failures degraded', () => {
    expect(retryPendingHealthSql).toMatch(
      /'testPublicationRetryPending', v_retry_waiting/i
    );
    expect(retryPendingHealthSql).toMatch(
      /'liveTerminalizationRetryPending', v_retry_waiting/i
    );
    expect(retryPendingHealthSql).toMatch(
      /v_failed :=[\s\S]*?testPublicationRetryPending[\s\S]*?liveTerminalizationRetryPending/i
    );
  });

  it('backs off poison live terminalization retries and preserves fresh-first order', () => {
    expect(retryPendingHealthSql).toMatch(
      /live_attempt_terminalization_failed'[\s\S]*?updated_at <=[\s\S]*?interval '30 seconds'/i
    );
    expect(retryPendingHealthSql).toMatch(
      /ORDER BY[\s\S]*?live_attempt_terminalization_failed'\) NULLS FIRST/i
    );
    expect(retryPendingHealthSql).toMatch(
      /v_should_log_failure :=[\s\S]*?UPDATE public\.quiz_events[\s\S]*?updated_at = pg_catalog\.clock_timestamp\(\)[\s\S]*?WHERE id = v_event\.id;/i
    );
  });

  it('authorizes player wakeups without relying on quiz event RLS', () => {
    expect(wakeupAccessSql).toMatch(
      /FUNCTION public\.can_receive_quiz_results_wakeup_v2\([\s\S]*?SECURITY DEFINER/i
    );
    expect(wakeupAccessSql).toMatch(
      /quiz_attempts AS attempt[\s\S]*?customer\.user_id = v_user_id/i
    );
    expect(wakeupAccessSql).toMatch(
      /CREATE POLICY "authorized players receive quiz results wakeups"[\s\S]*?can_receive_quiz_results_wakeup_v2\(realtime\.topic\(\)\)/i
    );
    expect(wakeupAccessSql).not.toMatch(
      /CREATE POLICY[\s\S]*?SELECT 1[\s\S]*?FROM public\.quiz_events/i
    );
  });

  it('enables deny-by-default RLS on the private test-publication gate', () => {
    expect(testPublicationControlRlsSql).toMatch(
      /ALTER TABLE private\.quiz_test_publication_control_v2[\s\S]*?ENABLE ROW LEVEL SECURITY/i
    );
    expect(testPublicationControlRlsSql).not.toMatch(/CREATE POLICY/i);
  });

  it('runs every deadline repair SQL proof in chronological replay CI', () => {
    for (const file of [
      'quiz_instant_retry_pending_health_v2.sql',
      'quiz_results_wakeup_player_access_v2.sql',
      'quiz_test_publication_control_rls_v2.sql',
    ]) {
      expect(ciWorkflow).toContain(
        `--sql-check supabase/migrations/tests/${file}`
      );
    }
  });
});
