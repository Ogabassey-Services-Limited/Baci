import { type NextRequest, NextResponse } from 'next/server';
import {
  getCronSecret,
  getQuizPhaseEnv,
  getQuizProductionApprovedEnv,
} from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createAdminClient } from '@/lib/supabase/admin';

// The finalizer runs a batch RPC that can close up to 100 due events, and the VPS
// worker gives this endpoint a 5-minute timeout. Match that here so Vercel can't
// terminate the function mid-batch (default route duration) and make the cron
// fail/retry while Supabase is still working through a backlog.
export const maxDuration = 300;

/**
 * GET /api/quiz/finalize
 *
 * Vercel Cron entrypoint that finalizes every due, compliance-verified quiz
 * event and mints its ranked winners. Vercel sends `Authorization: Bearer
 * ${CRON_SECRET}` automatically; any other caller is rejected.
 *
 * The heavy lifting (compliance gate, ranked-winner minting, idempotency,
 * concurrency safety) lives in the SECURITY DEFINER RPC
 * `public.finalize_due_quiz_events()`. Award minting is FAIL-CLOSED on
 * `quiz_events.compliance_verified` inside the RPC.
 */
export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: closed, error: closureError } = await supabase.rpc(
    'close_due_product_quiz_events'
  );

  if (closureError) {
    console.error('Quiz product closure failed:', closureError.message);
    return NextResponse.json(
      {
        error: 'Quiz product closure failed',
        code: 'QUIZ_PRODUCT_CLOSURE_FAILED',
      },
      { status: 500 }
    );
  }

  // Operational production-approval gate: never mint real prizes until QUIZ_PHASE
  // is 'production' AND operations has signed off (QUIZ_PRODUCTION_APPROVED).
  // The RPC also fails closed per-event on compliance_verified, but that is the
  // per-event permit gate — this is the global launch switch. Skip (not error)
  // so the cron stays green while prizes are still 1a/unapproved.
  if (getQuizPhaseEnv() !== 'production' || !getQuizProductionApprovedEnv()) {
    return NextResponse.json({
      closed: closed ?? 0,
      finalized: 0,
      skipped: 'production_not_approved',
    });
  }

  const { data, error } = await supabase.rpc('finalize_due_quiz_events');

  if (error) {
    console.error('Quiz finalize cron failed:', error);
    return NextResponse.json(
      { error: 'Quiz finalize failed', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ closed: closed ?? 0, finalized: data ?? 0 });
}
