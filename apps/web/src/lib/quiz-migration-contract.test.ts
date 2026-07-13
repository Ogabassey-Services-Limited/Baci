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
const voucherOrderRpcSql = readFileSync(
  resolve(migrationsDirectory, '20260522002607_quiz_voucher_order_rpc.sql'),
  'utf8'
);
const voucherOrderFinalizerSql = readFileSync(
  resolve(
    migrationsDirectory,
    '20260709163000_finalize_quiz_voucher_order_payment.sql'
  ),
  'utf8'
);
const regressionSql = readFileSync(
  resolve(migrationsDirectory, 'tests/quiz_phase1a_foundation.sql'),
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

  it('keeps quiz voucher payment finalization idempotent without overwriting terminal orders', () => {
    expect(voucherOrderFinalizerSql).toMatch(/o\.payment_status/i);
    expect(voucherOrderFinalizerSql).toMatch(/o\.payment_method/i);
    expect(voucherOrderFinalizerSql).toMatch(/o\.amount_paid/i);
    expect(voucherOrderFinalizerSql).toMatch(
      /payment_status\s*=\s*'paid'[\s\S]*payment_method\s*=\s*'quiz_voucher'[\s\S]*RETURN\s+true/i
    );
    expect(voucherOrderFinalizerSql).toMatch(
      /payment_status\s+NOT\s+IN\s*\(\s*'unpaid'\s*,\s*'pending'\s*\)[\s\S]*quiz_voucher_order_payment_status_invalid/i
    );
  });

  it('keeps quiz time-limit clamping compatible with PostgreSQL conditional expressions', () => {
    const lastClampPatchIndex = quizMigrationFiles.findLastIndex(
      ({ sql }) =>
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.start_quiz_attempt/i.test(
          sql
        ) &&
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.submit_quiz_answer/i.test(
          sql
        ) &&
        /LEAST\(GREATEST\(/i.test(sql)
    );
    const lastQualifiedClampBeforePatchIndex = quizMigrationFiles.findLastIndex(
      ({ sql }, index) =>
        index < lastClampPatchIndex &&
        /pg_catalog\.least\(pg_catalog\.greatest\(/i.test(sql)
    );
    const patchSql = quizMigrationFiles[lastClampPatchIndex]?.sql ?? '';

    expect(lastQualifiedClampBeforePatchIndex).toBeGreaterThanOrEqual(0);
    expect(lastClampPatchIndex).toBeGreaterThan(
      lastQualifiedClampBeforePatchIndex
    );
    expect(patchSql).toMatch(/public\.start_quiz_attempt/i);
    expect(patchSql).toMatch(/public\.submit_quiz_answer/i);
    expect(patchSql).not.toMatch(/pg_catalog\.(least|greatest)\(/i);
  });

  it('keeps catalog-backed migration regression checks for variant exposure', () => {
    expect(regressionSql).toMatch(/has_column_privilege/i);
    expect(regressionSql).toMatch(
      /pg_get_expr\s*\(\s*polqual\s*,\s*polrelid\s*\)/i
    );
    expect(regressionSql).toMatch(/answer_key_hash/i);
    expect(regressionSql).toMatch(/explanation/i);
    expect(regressionSql).toMatch(/quiz_events_client_read/i);
    expect(regressionSql).toMatch(/quiz_variants_client_read/i);
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

  // HISTORICAL. This pins the ORIGINAL Phase-1a migration file, which charged a
  // loyalty point. Migrations are append-only so that file still reads this way,
  // but it is NOT the live behaviour: 20260713180000_quiz_free_entry.sql made
  // entry free. The live contract is asserted in the free-entry test below.
  it('charged one customer loyalty point in the original Phase-1a migration', () => {
    const startAttemptSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.start_quiz_attempt[\s\S]*?\$\$;/i
    )?.[0];

    expect(startAttemptSql).toBeDefined();
    expect(startAttemptSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*p_event_id\s+AND\s+e\.merchant_id\s*=\s*c\.merchant_id/i
    );
    expect(startAttemptSql).toMatch(/v_exam_pass_cost\s+integer\s*:=\s*1/i);
    expect(startAttemptSql).toMatch(/quiz_exam_pass_required/i);
    expect(startAttemptSql).toMatch(/ERRCODE\s*=\s*'QZ011'/i);
    expect(startAttemptSql).toMatch(
      /'remainingLoyaltyPoints',\s*v_remaining_loyalty_points/i
    );
  });

  it('makes quiz entry free: the latest start_quiz_attempt never charges loyalty points', () => {
    // The LIVE definition is whichever quiz migration defines start_quiz_attempt
    // last (filename order == apply order), so this keeps asserting the truth
    // even if a later migration redefines the function again.
    const latestStartAttemptSql = quizMigrationFiles
      .map(
        ({ sql }) =>
          sql.match(
            /CREATE OR REPLACE FUNCTION public\.start_quiz_attempt[\s\S]*?\$\$;/i
          )?.[0]
      )
      .filter((sql): sql is string => Boolean(sql))
      .at(-1);

    expect(latestStartAttemptSql).toBeDefined();

    // Entry is free, and no code path may deduct points.
    expect(latestStartAttemptSql).toMatch(
      /v_exam_pass_cost\s+constant\s+integer\s*:=\s*0/i
    );
    expect(latestStartAttemptSql).not.toMatch(/quiz_exam_pass_required/i);
    expect(latestStartAttemptSql).not.toMatch(/ERRCODE\s*=\s*'QZ011'/i);
    expect(latestStartAttemptSql).not.toMatch(
      /SET\s+loyalty_points\s*=\s*COALESCE\(c\.loyalty_points,\s*0\)\s*-/i
    );

    // The customer gate STAYS: a customers row is created by free signup, so it
    // gates on "registered on this store", not on having purchased anything.
    expect(latestStartAttemptSql).toMatch(/quiz_customer_not_found/i);
    expect(latestStartAttemptSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*p_event_id\s+AND\s+e\.merchant_id\s*=\s*c\.merchant_id/i
    );

    // The attempt cap must survive the rewrite — it is the only thing left
    // stopping a player from farming unlimited attempts now that entry is free.
    expect(latestStartAttemptSql).toMatch(/attempt_limit_reached/i);
    expect(latestStartAttemptSql).toMatch(/ERRCODE\s*=\s*'QZ030'/i);
  });

  // Free entry is meaningless if PURCHASES still decide who WINS. Both ranking
  // functions used to break score ties on `COALESCE(loyalty_points, 0) DESC`,
  // and loyalty points are only ever earned by buying — so a free entrant tied
  // on score always lost to a bigger spender. Ranking must be skill and speed
  // only, in BOTH functions, or the leaderboard players watch stops matching the
  // winners actually minted.
  it.each([
    [
      'mint_quiz_event_ranked_awards',
      /CREATE OR REPLACE FUNCTION public\.mint_quiz_event_ranked_awards[\s\S]*?\$\$;/i,
    ],
    [
      'get_quiz_leaderboard',
      /CREATE OR REPLACE FUNCTION public\.get_quiz_leaderboard[\s\S]*?\$\$;/i,
    ],
  ])('ranks %s on skill and speed only — never on loyalty points', (_name, pattern) => {
    const latestSql = quizMigrationFiles
      .map(({ sql }) => sql.match(pattern)?.[0])
      .filter((sql): sql is string => Boolean(sql))
      .at(-1);

    expect(latestSql).toBeDefined();

    // No purchase-derived term may appear in ANY ordering key.
    expect(latestSql).not.toMatch(/loyalty_points\s*,?\s*0?\)?\s*DESC/i);
    expect(latestSql).not.toMatch(/COALESCE\([a-z]+\.loyalty_points/i);

    // The deterministic skill/speed keys must still be there, so ties never
    // resolve arbitrarily (which would make winners non-reproducible).
    expect(latestSql).toMatch(/score\s+DESC/i);
    expect(latestSql).toMatch(
      /EXTRACT\(EPOCH FROM \([a-z_]+\.submitted_at - [a-z_]+\.started_at\)\)[\s\S]*?ASC NULLS LAST/i
    );
    expect(latestSql).toMatch(/submitted_at\s+ASC/i);
  });

  it('checks finalize-awards attempt ownership before calling the privileged event finalizer', () => {
    const finalizeAwardsSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_quiz_awards[\s\S]*?\$\$;/i
    )?.[0];

    expect(finalizeAwardsSql).toBeDefined();
    expect(finalizeAwardsSql).toMatch(
      /JOIN\s+public\.customers\s+c\s+ON\s+c\.id\s*=\s*a\.customer_id/i
    );
    expect(finalizeAwardsSql).toMatch(/a\.id\s*=\s*p_attempt_id/i);
    expect(finalizeAwardsSql).toMatch(/a\.event_id\s*=\s*p_event_id/i);
    expect(finalizeAwardsSql).toMatch(/a\.status\s*=\s*'submitted'/i);
    expect(finalizeAwardsSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
    expect(finalizeAwardsSql).toMatch(/quiz_attempt_not_found/i);
    expect(finalizeAwardsSql?.indexOf('JOIN public.customers c')).toBeLessThan(
      finalizeAwardsSql?.indexOf('public.finalize_quiz_event_awards') ?? -1
    );
  });

  it('makes event award finalization idempotent before queueing work', () => {
    const eventFinalizerSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_quiz_event_awards[\s\S]*?\$\$;/i
    )?.[0];

    expect(eventFinalizerSql).toBeDefined();
    expect(eventFinalizerSql).toMatch(
      /UPDATE\s+public\.quiz_events[\s\S]*award_finalized_at\s*=\s*pg_catalog\.now\(\)[\s\S]*WHERE\s+id\s*=\s*p_event_id[\s\S]*award_finalized_at\s+IS\s+NULL/is
    );
    expect(eventFinalizerSql).toMatch(/IF\s+NOT\s+FOUND\s+THEN\s+RETURN\s+0/is);
    expect(
      eventFinalizerSql?.indexOf('UPDATE public.quiz_events')
    ).toBeLessThan(
      eventFinalizerSql?.indexOf(
        'INSERT INTO public.leaderboard_refresh_log'
      ) ?? -1
    );
  });

  it('scopes prize claim customer lookups through the award event merchant', () => {
    const grandClaimSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.claim_quiz_grand_prize[\s\S]*?\$\$;/i
    )?.[0];
    const cashClaimSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.claim_quiz_cash_award[\s\S]*?\$\$;/i
    )?.[0];

    expect(grandClaimSql).toBeDefined();
    expect(cashClaimSql).toBeDefined();
    expect(grandClaimSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*p_event_id\s+AND\s+e\.merchant_id\s*=\s*c\.merchant_id/i
    );
    expect(grandClaimSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
    expect(cashClaimSql).toMatch(/FROM\s+public\.quiz_awards\s+qa/i);
    expect(cashClaimSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*qa\.event_id/i
    );
    expect(cashClaimSql).toMatch(
      /JOIN\s+public\.customers\s+c\s+ON\s+c\.merchant_id\s*=\s*e\.merchant_id/i
    );
    expect(cashClaimSql).toMatch(/qa\.id\s*=\s*p_award_id/i);
    expect(cashClaimSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
  });

  it('adds a proof-gated voucher order RPC without exposing it to anon callers', () => {
    expect(voucherOrderRpcSql).toMatch(
      /ALTER\s+TABLE\s+public\.order_items[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+quiz_award_id\s+uuid/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_order_items_quiz_award_id_unique/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher/i
    );
    expect(voucherOrderRpcSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(voucherOrderRpcSql).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(voucherOrderRpcSql).toMatch(
      /public\.quiz_route_proof_valid\s*\(\s*p_route_proof\s*,\s*'create_storefront_order_with_quiz_voucher'\s*,\s*v_award_id::text\s*,\s*p_user_id\s*\)/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /jsonb_array_elements\s*\(\s*p_items\s*\)/i
    );
    expect(voucherOrderRpcSql).toMatch(/v_voucher_item_count\s*<>\s*1/i);
    expect(voucherOrderRpcSql).toMatch(/FOR\s+UPDATE\s+OF\s+qa/i);
    expect(voucherOrderRpcSql).toMatch(/qa\.status\s*<>\s*'approved'/i);
    expect(voucherOrderRpcSql).toMatch(/qa\.award_type\s*<>\s*'store_credit'/i);
    expect(voucherOrderRpcSql).toMatch(/public\.create_storefront_order\s*\(/i);
    expect(voucherOrderRpcSql).toMatch(
      /p_discount_amount\s*=>\s*COALESCE\s*\(\s*p_discount_amount\s*,\s*0\s*\)\s*\+\s*COALESCE\s*\(\s*v_award_amount\s*,\s*0\s*\)/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /UPDATE\s+public\.order_items[\s\S]*SET\s+quiz_award_id\s*=\s*v_award_id/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /UPDATE\s+public\.quiz_awards[\s\S]*SET\s+status\s*=\s*'claimed'/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher[\s\S]*FROM\s+PUBLIC,\s+anon,\s+authenticated/i
    );
    expect(voucherOrderRpcSql).not.toMatch(
      /GRANT\s+(?:ALL|EXECUTE)[\s\S]*create_storefront_order_with_quiz_voucher[\s\S]*TO\s+anon/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher[\s\S]*TO\s+authenticated,\s+service_role/i
    );
  });

  it('records non-sensitive proof validation failures without granting client access', () => {
    expect(foundationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.quiz_proof_validation_failures/is
    );
    expect(foundationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_proof_validation_failures\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
    expect(foundationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE[\s\S]*public\.quiz_proof_validation_failures[\s\S]*FROM\s+anon,\s+authenticated/i
    );
    expect(foundationSql).toMatch(/subject_id\s+text/i);
    expect(foundationSql).toMatch(/action\s+text/i);
    expect(foundationSql).toMatch(/created_at\s+timestamptz\s+NOT\s+NULL/i);
    expect(rpcSql).toMatch(/quiz_log_route_proof_failure/is);
    expect(rpcSql).toMatch(/v_proof->>'subject_id'/i);
    expect(rpcSql).toMatch(/v_proof->>'action'/i);
    expect(rpcSql).toMatch(/'signature_mismatch'/i);
    expect(rpcSql).not.toMatch(/signature\s*,\s*reason/i);
  });

  it('creates production approval evidence columns and tracker table', () => {
    expect(foundationSql).toMatch(/nlrc_permit_ref\s+text/i);
    expect(foundationSql).toMatch(/published_odds\s+jsonb/i);
    expect(foundationSql).toMatch(/compliance_flags\s+jsonb/i);
    expect(foundationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.quiz_compliance_tracker/is
    );
    expect(foundationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_compliance_tracker\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
  });

  it('keeps quiz awards customer ownership non-null and non-orphaning', () => {
    expect(foundationSql).toMatch(
      /customer_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.customers\(id\)\s+ON\s+DELETE\s+RESTRICT/i
    );
    expect(foundationSql).toMatch(/chk_quiz_awards_attempt_required/i);
    expect(foundationSql).toMatch(
      /award_type\s+IN\s+\('cash',\s*'store_credit'\)\s+AND\s+attempt_id\s+IS\s+NOT\s+NULL/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_quiz_awards_customer\s+ON\s+public\.quiz_awards\(customer_id\);/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+quiz_awards_customer_read[\s\S]*c\.id\s*=\s*customer_id[\s\S]*c\.user_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)/i
    );
  });
});
