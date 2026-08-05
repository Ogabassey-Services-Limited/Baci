import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260804110000_quiz_final_results_and_product_winner.sql'
  ),
  'utf8'
);

describe('quiz final results migration', () => {
  it('separates always-safe test closure from gated live award creation', () => {
    expect(sql).toContain('finalize_due_test_quiz_events_v2');
    expect(sql).toContain('terminalize_due_live_quiz_events_v2');
    expect(sql).toContain('p_production_phase IS NOT TRUE');
    expect(sql).toContain('p_production_approved IS NOT TRUE');
    expect(sql).toContain(
      "finalization_error_code = 'live_award_gate_unavailable'"
    );
  });

  it('publishes only terminal test, awarded, or no-winner outcomes', () => {
    expect(sql).toContain("finalization_state = 'test_published'");
    expect(sql).toContain("finalization_state = 'no_winner'");
    expect(sql).toContain("finalization_state = 'awarded'");
    expect(sql).toContain('results_published_at = clock_timestamp()');
  });

  it('enforces one live ranked product award and rejects test prizes', () => {
    expect(sql).toContain('idx_quiz_awards_one_ranked_product_v2_per_event');
    expect(sql).toContain("WHERE award_source = 'ranked_product_v2'");
    expect(sql).toContain("IF v_mode = 'test'");
    expect(sql).toContain("RAISE EXCEPTION 'quiz_test_prize_forbidden'");
  });

  it('gives the test finalizer no reservation, award, order, voucher, or notification path', () => {
    const testBody = sql
      .split(
        'CREATE OR REPLACE FUNCTION public.finalize_due_test_quiz_events_v2'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.terminalize_due_live_quiz_events_v2'
      )[0];
    expect(testBody).toBeTruthy();
    expect(testBody).not.toMatch(
      /quiz_prize_reservations|quiz_awards|orders|voucher|notification/i
    );
  });

  it('uses deterministic score and speed ranking without exposing answers', () => {
    expect(sql).toContain(
      'ORDER BY b.score DESC, b.submitted_at - b.started_at, b.submitted_at, b.id'
    );
    expect(sql).not.toMatch(/get_quiz_attempt_result_v2[\s\S]*answer_payload/);
    expect(sql).not.toMatch(/get_quiz_attempt_result_v2[\s\S]*answer_key_hash/);
  });

  it('persists exact claim expiry and releases expired inventory idempotently', () => {
    expect(sql).toContain(
      'claim_expires_at = clock_timestamp() + make_interval'
    );
    expect(sql).toContain('expire_unclaimed_ranked_quiz_awards_v2');
    expect(sql).toContain(
      "IF v_res.id IS NULL OR v_res.state = 'released' THEN RETURN false"
    );
  });

  it('transfers the exact serialized hold without reopening legacy selection', () => {
    const transfer = sql
      .split(
        'CREATE OR REPLACE FUNCTION private.transfer_quiz_prize_to_winner_v2'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.finalize_due_live_quiz_events_v2'
      )[0];
    expect(transfer).toBeTruthy();
    expect(transfer).toContain("IF v_res.inventory_kind = 'serialized'");
    expect(transfer).toContain('WHERE id = v_res.inventory_unit_id');
    expect(transfer).toContain('order_item_id = v_order_item_id');
    expect(transfer).toContain("IF v_res.inventory_kind <> 'serialized'");
    expect(transfer).not.toContain("SET status = 'available'");
    expect(transfer).not.toContain(
      'claim_variant_inventory_units_for_order_item_internal'
    );
    expect(transfer).toContain(
      'private.sync_serialized_stock(v_res.merchant_id, v_res.product_id)'
    );
  });

  it('keeps both legacy worker entrypoints scoped to contract version 1', () => {
    const legacyClose = sql
      .split(
        'CREATE OR REPLACE FUNCTION public.close_due_product_quiz_events()'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.finalize_due_quiz_events()'
      )[0];
    const legacyFinalize = sql
      .split('CREATE OR REPLACE FUNCTION public.finalize_due_quiz_events()')[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.expire_unclaimed_ranked_quiz_awards_v2()'
      )[0];
    expect(legacyClose).toContain('e.contract_version = 1');
    expect(legacyFinalize).toContain('WHERE e.contract_version = 1');
    expect(legacyFinalize).toContain(
      'WHERE e.id = v_ranked_event_id AND e.contract_version = 1'
    );
  });

  it('returns the shared v2 result discriminant and never emits a rankless final', () => {
    const result = sql.split(
      'CREATE OR REPLACE FUNCTION public.get_quiz_attempt_result_v2'
    )[1];
    expect(result).toContain(
      "'attemptId', v_attempt.id, 'availability', 'pending', 'availableAt'"
    );
    expect(result).toContain(
      "'attemptId', v_attempt.id, 'availability', 'final'"
    );
    expect(result).toContain("'totalQuestions', v_event.question_count");
    expect(result).toContain('IF v_rank IS NULL THEN');
    expect(result).toContain("'availableAt', v_event.results_published_at");
    expect(result).toContain("'awardId', v_award.id");
    expect(result).toContain("'expiresAt', v_award.claim_expires_at");
    expect(result).not.toContain("'status', v_award.status");
    expect(result).not.toMatch(/product_id|reserved_order|inventory_unit/);
    expect(result).not.toContain("'status','final'");
    expect(result).not.toContain("'finalizing'");
    expect(result).not.toContain("'resultsAvailableAt'");
  });

  it('locks event before reservation release and makes release one-way', () => {
    const release = sql
      .split(
        'CREATE OR REPLACE FUNCTION private.release_quiz_prize_reservation_v2'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION private.quiz_ranked_candidates_v2'
      )[0];
    expect(release?.indexOf('FROM public.quiz_events')).toBeLessThan(
      release?.indexOf('FROM public.quiz_prize_reservations') ?? -1
    );
    expect(release).toContain("v_res.state = 'released'");
    expect(release).toContain("SET state = 'released'");
    expect(release).toContain(
      'FROM public.quiz_awards WHERE id = v_res.award_id FOR UPDATE'
    );
    expect(
      release?.indexOf('FROM public.quiz_prize_reservations')
    ).toBeLessThan(release?.indexOf('FROM public.quiz_awards') ?? -1);

    const expiry = sql
      .split(
        'CREATE OR REPLACE FUNCTION public.expire_unclaimed_ranked_quiz_awards_v2'
      )[1]
      ?.split(
        'CREATE OR REPLACE FUNCTION public.get_quiz_attempt_result_v2'
      )[0];
    expect(expiry).toContain('FOR UPDATE OF e SKIP LOCKED');
    expect(expiry?.indexOf('FOR UPDATE OF e SKIP LOCKED')).toBeLessThan(
      expiry?.indexOf("UPDATE public.quiz_awards SET status = 'void'") ?? -1
    );
  });
});
