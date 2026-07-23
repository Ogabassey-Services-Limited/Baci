import type { SupabaseClient } from '@supabase/supabase-js';
import { agenticDvaCutoverCli } from '@/lib/agentic/agentic-dva-cutover-cli';
import { agenticDvaCutoverConstants } from '@/lib/agentic/agentic-dva-cutover-constants';
import { assessAgenticDvaCutoverSession } from '@/lib/agentic/agentic-dva-cutover-evidence';
import { logger } from '@/lib/logger';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function runAuditAgenticDvaConsentCutoverCli(
  argv: string[],
  supabase: SupabaseClient,
  now = new Date()
): Promise<number> {
  if (!agenticDvaCutoverCli.isPaused()) {
    console.error(
      'Agentic Paystack DVA must be paused before the cutover audit.'
    );
    return 1;
  }
  const limit = parseArgs(argv);
  const serviceClient = supabase;
  const states: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  let hasManualReview = false;
  let isTruncated = false;

  for (const state of agenticDvaCutoverConstants.transitionalStates) {
    let query = serviceClient
      .from('checkout_sessions')
      .select(agenticDvaCutoverConstants.sessionSelect, { count: 'exact' })
      .eq('metadata->agentic->>payment_state', state);
    if (state === 'order_finalizing') {
      query = query.or(
        'metadata->agentic->>payment_method.is.null,metadata->agentic->>payment_method.neq.pay_on_delivery'
      );
    }
    const { count, data, error } = await query
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error || count === null) {
      const errorRecord =
        error && typeof error === 'object'
          ? (error as Record<string, unknown>)
          : null;
      logger.error({
        code: 'AGENTIC_DVA_CUTOVER_AUDIT_READ_FAILED',
        databaseCode:
          typeof errorRecord?.code === 'string' ? errorRecord.code : undefined,
        errorType:
          error instanceof Error
            ? error.name
            : error === null
              ? 'missing_count'
              : typeof error,
        message: 'Agentic DVA cutover audit transitional-state read failed',
        state,
      });
      console.error(
        'Agentic DVA cutover audit failed while reading transitional state.'
      );
      return 1;
    }

    const entries = (data ?? []).map((row) => {
      const assessment = assessAgenticDvaCutoverSession(row, now);
      if (assessment.disposition === 'manual_review') hasManualReview = true;
      return {
        disposition: assessment.disposition,
        evidence_fingerprint: assessment.evidenceFingerprint,
        ...(assessment.reason ? { reason: assessment.reason } : {}),
        session_id: assessment.sessionId,
      };
    });
    const truncated = count > entries.length;
    counts[state] = count;
    isTruncated ||= truncated;
    states[state] = { count, entries, truncated };
  }

  const totalCount = agenticDvaCutoverConstants.transitionalStates.reduce(
    (total, state) => total + counts[state],
    0
  );
  const zeroTransitionalStates = totalCount === 0;
  const rolloutBlocked =
    !zeroTransitionalStates || hasManualReview || isTruncated;
  console.log(
    JSON.stringify(
      {
        limit,
        mode: 'read_only',
        rollout_blocked: rolloutBlocked,
        states,
        total_count: totalCount,
        transitional_counts: counts,
        zero_transitional_states: zeroTransitionalStates,
      },
      null,
      2
    )
  );
  return rolloutBlocked ? 1 : 0;
}

function parseArgs(argv: string[]): number {
  let limit = DEFAULT_LIMIT;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== '--limit') throw new Error('Unknown argument');
    index += 1;
    const value = Number(argv[index]);
    if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
      throw new Error(`--limit requires an integer from 1 to ${MAX_LIMIT}`);
    }
    limit = value;
  }
  return limit;
}
