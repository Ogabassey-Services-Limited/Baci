import { readFileSync } from 'node:fs';
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
const regressionSql = readFileSync(
  resolve(migrationsDirectory, 'tests/quiz_phase1a_foundation.sql'),
  'utf8'
);

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

  it('requires and spends one customer loyalty point before starting an exam attempt', () => {
    const startAttemptSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.start_quiz_attempt[\s\S]*?\$\$;/i
    )?.[0];

    expect(startAttemptSql).toBeDefined();
    expect(startAttemptSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*p_event_id\s+AND\s+e\.merchant_id\s*=\s*c\.merchant_id/i
    );
    expect(startAttemptSql).toMatch(/v_exam_pass_cost\s+integer\s*:=\s*1/i);
    expect(startAttemptSql).toMatch(
      /SELECT\s+COALESCE\(c\.loyalty_points,\s*0\)[\s\S]*FROM\s+public\.customers\s+c[\s\S]*FOR\s+UPDATE/i
    );
    expect(startAttemptSql).toMatch(/quiz_exam_pass_required/i);
    expect(startAttemptSql).toMatch(/ERRCODE\s*=\s*'QZ011'/i);
    expect(startAttemptSql).toMatch(
      /UPDATE\s+public\.customers\s+c[\s\S]*SET\s+loyalty_points\s*=\s*COALESCE\(c\.loyalty_points,\s*0\)\s*-\s*v_exam_pass_cost/i
    );
    expect(startAttemptSql).toMatch(
      /'examPassPointsSpent',\s*v_exam_pass_cost/i
    );
    expect(startAttemptSql).toMatch(
      /'remainingLoyaltyPoints',\s*v_remaining_loyalty_points/i
    );
    expect(startAttemptSql?.indexOf('UPDATE public.customers c')).toBeLessThan(
      startAttemptSql?.indexOf('INSERT INTO public.quiz_attempts') ?? -1
    );
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
