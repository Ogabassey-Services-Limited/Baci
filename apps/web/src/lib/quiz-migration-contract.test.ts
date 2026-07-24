import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);
const foundationSql = readFileSync(
  resolve(migrationsDirectory, '20260516084349_quiz_phase1a_foundation.sql'),
  'utf8'
);
const rpcSql = readFileSync(
  resolve(migrationsDirectory, '20260516084622_quiz_phase1a_rpcs.sql'),
  'utf8'
);
const quizMigrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => /^20\d{12}_.*quiz.*\.sql$/.test(file))
  .sort()
  .map((file) => ({
    file,
    sql: readFileSync(resolve(migrationsDirectory, file), 'utf8'),
  }));
const allQuizMigrationSql = quizMigrationFiles
  .map(({ sql }) => sql)
  .join('\n\n');

describe('quiz migration contracts', () => {
  // Fragile by design: these regex assertions pin RLS, restricted GRANT columns,
  // and proof-validation constraints that must not drift silently.
  it('exposes only safe assigned question variant fields to authenticated quiz clients', () => {
    const variantGrant = foundationSql.match(
      /GRANT\s+SELECT\s*\(([^)]*)\)\s+ON\s+public\.quiz_question_variants\s+TO\s+authenticated/i
    )?.[1];

    expect(variantGrant).toBeDefined();
    const variantGrantColumns = new Set(
      (variantGrant ?? '')
        .split(',')
        .map((column) => column.trim().toLowerCase())
        .filter(Boolean)
    );
    const variantGrantColumnList = [...variantGrantColumns];
    expect(variantGrantColumns).toEqual(new Set(['id', 'prompt', 'options']));
    expect(variantGrantColumnList).not.toContain('answer_key_hash');
    expect(variantGrantColumnList).not.toContain('explanation');
    expect(foundationSql).not.toMatch(
      /GRANT\s+SELECT\s*\([^)]*\)\s+ON\s+public\.quiz_question_variants\s+TO\s+anon/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+quiz_variants_client_read\s+ON\s+public\.quiz_question_variants\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s+\(active\s+AND\s+EXISTS\s+\(SELECT\s+1\s+FROM\s+public\.quiz_attempt_questions/is
    );
  });

  it('scopes direct quiz event reads to authenticated customer merchants', () => {
    expect(foundationSql).not.toMatch(
      /GRANT\s+SELECT\s*\([^)]*\)\s+ON\s+public\.quiz_events\s+TO\s+anon/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+quiz_events_client_read\s+ON\s+public\.quiz_events\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s+\(status\s+IN\s+\('scheduled',\s*'active',\s*'completed'\)\s+AND\s+EXISTS\s+\(SELECT\s+1\s+FROM\s+public\.customers\s+c\s+WHERE\s+c\.merchant_id\s*=\s*quiz_events\.merchant_id\s+AND\s+c\.user_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)\)\)/is
    );
  });

  it('allows direct quiz slot reads only for listable customer merchant events', () => {
    expect(foundationSql).not.toMatch(
      /GRANT\s+SELECT\s*\([^)]*\)\s+ON\s+public\.quiz_question_slots\s+TO\s+anon/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+quiz_slots_client_read\s+ON\s+public\.quiz_question_slots\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s+\(active\s+AND\s+EXISTS\s+\(SELECT\s+1\s+FROM\s+public\.quiz_events\s+e\s+JOIN\s+public\.customers\s+c\s+ON\s+c\.merchant_id\s*=\s*e\.merchant_id[\s\S]*e\.id\s*=\s*quiz_question_slots\.event_id[\s\S]*c\.user_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)\)\)/is
    );
  });

  it('enforces authenticated customer ownership before recording an answer', () => {
    const signature = rpcSql.match(
      /public\.record_quiz_answer\s*\(([^)]*)\)/is
    )?.[1];

    expect(signature).toBeDefined();
    expect(signature).toMatch(/p_attempt_id\s+uuid/i);
    expect(signature).toMatch(/p_question_slot_id\s+uuid/i);
    expect(signature).toMatch(/p_answer_payload\s+jsonb/i);
    expect(signature).toMatch(/p_user_id\s+uuid/i);
    expect(signature).toMatch(/p_trusted\s+boolean\s+DEFAULT\s+false/i);
    expect(rpcSql).toMatch(
      /JOIN\s+public\.customers\s+c\s+ON\s+c\.id\s*=\s*a\.customer_id/i
    );
    expect(rpcSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
    expect(rpcSql).toMatch(
      /public\.quiz_route_proof_valid\s*\(\s*p_route_proof\s*,\s*'record_quiz_answer'\s*,\s*p_attempt_id::text\s*\|\|\s*':'\s*\|\|\s*p_question_slot_id::text\s*,\s*p_user_id\s*\)/is
    );
    expect(rpcSql).toMatch(
      /public\.record_quiz_answer\s*\([\s\S]*?p_route_proof,\s*p_user_id,\s*true\s*\)/i
    );
  });

  it('keeps quiz route proof future clock skew tightly bounded', () => {
    expect(rpcSql).toMatch(/INTERVAL\s+'30 seconds'/i);
    expect(rpcSql).toMatch(/small future skew for serverless clock drift/i);
    expect(rpcSql).not.toMatch(/INTERVAL\s+'1 minute'/i);
  });

  it('signs payload hashes and derives answer completion from answered question count', () => {
    expect(rpcSql).toMatch(/v_payload_hash\s+text/i);
    expect(rpcSql).toMatch(/v_canonical\s*:=.*v_payload_hash/is);
    expect(rpcSql).toMatch(/quiz_compare_signatures/i);
    expect(rpcSql).toMatch(
      /extensions\.digest\(COALESCE\(p_left,\s*''\),\s*'sha256'\)\s*=\s*extensions\.digest\(COALESCE\(p_right,\s*''\),\s*'sha256'\)/i
    );
    expect(rpcSql).toMatch(/pg_advisory_xact_lock/is);
    expect(rpcSql).toMatch(
      /WITH\s+selected_variant_per_slot\s+AS[\s\S]*pg_catalog\.md5\([^)]*variant\.id::text\s*\|\|\s*p_event_id::text\s*\|\|\s*v_customer_id::text\)/is
    );
    expect(rpcSql).toMatch(/v_answered_questions\s*>=\s*v_total_questions/i);
  });

  it('scores submitted answers from server-side variant answer hashes', () => {
    expect(allQuizMigrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.quiz_normalize_answer_key/i
    );
    expect(allQuizMigrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.quiz_answer_key_matches/i
    );
    expect(allQuizMigrationSql).toMatch(
      /answer_key_hash\s+~\s*'\^\[0-9a-f\]\{64\}\$'/i
    );
    expect(allQuizMigrationSql).toMatch(
      /JOIN\s+public\.quiz_question_variants\s+qv\s+ON\s+qv\.id\s*=\s*q\.variant_id/i
    );
    expect(allQuizMigrationSql).toMatch(
      /v_score_delta\s*:=\s*CASE\s+WHEN\s+public\.quiz_answer_key_matches\(/is
    );
    expect(allQuizMigrationSql).toMatch(
      /INSERT\s+INTO\s+public\.quiz_attempt_answers[\s\S]*score_delta[\s\S]*v_score_delta/is
    );
  });

  it('prevents duplicate answer replay from overwriting scored answers', () => {
    const scoringRecordAnswerSql = allQuizMigrationSql
      .match(
        /CREATE OR REPLACE FUNCTION public\.record_quiz_answer[\s\S]*?\$\$;/gi
      )
      ?.at(-1);

    expect(scoringRecordAnswerSql).toBeDefined();
    expect(scoringRecordAnswerSql).toMatch(
      /ON\s+CONFLICT\s*\(\s*attempt_question_id\s*\)\s+DO\s+NOTHING/i
    );
    expect(scoringRecordAnswerSql).not.toMatch(
      /ON\s+CONFLICT\s*\(\s*attempt_question_id\s*\)\s+DO\s+UPDATE/i
    );
    expect(scoringRecordAnswerSql).toMatch(
      /GET\s+DIAGNOSTICS\s+v_inserted_rows\s*=\s*ROW_COUNT/i
    );
    expect(scoringRecordAnswerSql).toMatch(/quiz_answer_already_recorded/i);
    expect(scoringRecordAnswerSql).toMatch(/ERRCODE\s*=\s*'QZ026'/i);
    expect(scoringRecordAnswerSql).toMatch(
      /IF\s+EXISTS\s*\([\s\S]*quiz_attempt_answers[\s\S]*attempt_question_id\s*=\s*v_attempt_question_id[\s\S]*ERRCODE\s*=\s*'QZ026'/i
    );
  });

  it('enforces server-issued answer timing before scoring', () => {
    expect(allQuizMigrationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_attempt_questions[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+issued_at\s+timestamptz/i
    );
    expect(allQuizMigrationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_attempt_questions[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+time_limit_ms\s+integer/i
    );
    expect(allQuizMigrationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_attempt_answers[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+answered_in_ms\s+integer/i
    );

    const scoringRecordAnswerSql = allQuizMigrationSql
      .match(
        /CREATE OR REPLACE FUNCTION public\.record_quiz_answer[\s\S]*?\$\$;/gi
      )
      ?.at(-1);

    expect(scoringRecordAnswerSql).toBeDefined();
    expect(scoringRecordAnswerSql).toMatch(/v_answered_in_ms/i);
    expect(scoringRecordAnswerSql).toMatch(/v_answered_in_ms\s+bigint/i);
    expect(scoringRecordAnswerSql).toMatch(/quiz_question_not_issued/i);
    expect(scoringRecordAnswerSql).toMatch(/answer_too_fast/i);
    expect(scoringRecordAnswerSql).toMatch(/v_answered_in_ms\s*<\s*400/i);
    // A too-late answer is no longer fatal: instead of RAISE 'answer_too_late'
    // (which bricked the attempt), it is recorded as incorrect and the attempt
    // advances. The elapsed comparison still gates the `v_late` flag, and the
    // stored answered_in_ms is clamped to satisfy the column CHECK.
    expect(scoringRecordAnswerSql).not.toMatch(
      /RAISE\s+EXCEPTION\s+'answer_too_late'/i
    );
    expect(scoringRecordAnswerSql).toMatch(/v_late\s+boolean/i);
    expect(scoringRecordAnswerSql).toMatch(
      /v_answered_in_ms\s*>\s*COALESCE\(\s*v_time_limit_ms,\s*30000\s*\)\s*\+\s*1000/i
    );
    expect(scoringRecordAnswerSql).toMatch(
      /LEAST\(\s*v_answered_in_ms,\s*60000\s*\)::integer/i
    );
    expect(scoringRecordAnswerSql).toMatch(/\*\s*1000\s*\)\s*::bigint/i);
    expect(scoringRecordAnswerSql).toMatch(
      /INSERT\s+INTO\s+public\.quiz_attempt_answers[\s\S]*answered_in_ms[\s\S]*v_answered_in_ms/is
    );
    expect(scoringRecordAnswerSql).toMatch(
      /pg_catalog\.extract\(\s*'epoch'\s*,\s*pg_catalog\.now\(\)\s*-\s*v_issued_at\s*\)\s*\*\s*1000/i
    );
    expect(scoringRecordAnswerSql).not.toMatch(
      /pg_catalog\.extract\(\s*epoch\s+FROM/i
    );
  });

  it('allows bounded HMAC verification with the previous quiz proof secret', () => {
    expect(foundationSql).toMatch(
      /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto\s+WITH\s+SCHEMA\s+extensions/i
    );
    expect(rpcSql).toMatch(/extensions\.digest/i);
    expect(rpcSql).toMatch(/v_previous_secret\s+text/i);
    expect(rpcSql).toMatch(/v_previous_expires_at\s+timestamptz/i);
    expect(rpcSql).toMatch(
      /IF\s+v_previous_expires_at\s+IS\s+NOT\s+NULL\s+AND\s+v_previous_expires_at\s+>\s+pg_catalog\.now\(\)\s+THEN/is
    );
    expect(rpcSql).toMatch(
      /extensions\.hmac\(v_canonical,\s*v_previous_secret,\s*'sha256'\)/is
    );
  });

  it('binds privileged award claim helpers to route proof action and subject', () => {
    expect(rpcSql).toMatch(
      /public\.quiz_route_proof_valid\s*\(\s*p_route_proof\s*,\s*'claim_grand_prize'\s*,\s*v_award_event_id::text\s*,\s*NULL\s*\)/is
    );
    expect(rpcSql).toMatch(
      /public\.quiz_route_proof_valid\s*\(\s*p_route_proof\s*,\s*'claim_cash_award'\s*,\s*p_award_id::text\s*,\s*NULL\s*\)/is
    );
  });

  it('checks answer ownership before validating route proof with a user id', () => {
    const recordAnswerSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.record_quiz_answer[\s\S]*?\$\$;/i
    )?.[0];

    expect(recordAnswerSql).toBeDefined();
    const userCheckIndex = recordAnswerSql?.indexOf('IF p_user_id IS NULL');
    const proofValidationIndex = recordAnswerSql?.indexOf(
      'public.quiz_route_proof_valid'
    );

    expect(userCheckIndex).toBeGreaterThanOrEqual(0);
    expect(proofValidationIndex).toBeGreaterThanOrEqual(0);
    expect(userCheckIndex).toBeLessThan(proofValidationIndex ?? -1);
  });

  it('selects customer rows deterministically when timestamps tie', () => {
    expect(rpcSql).toMatch(/ORDER BY c\.created_at DESC,\s*c\.id DESC/i);
    expect(
      rpcSql.match(/ORDER BY c\.created_at DESC,\s*c\.id DESC/gi)
    ).toHaveLength(3);
  });
});
