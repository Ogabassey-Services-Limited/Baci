import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';
import { createAdminClient } from '@/lib/supabase/admin';

export async function finalizeDueQuizEvents() {
  const supabase = createAdminClient();
  const { data: closed, error: closureError } = await supabase.rpc(
    'close_due_product_quiz_events'
  );

  if (closureError) {
    console.error('Quiz product closure failed');
    return {
      body: {
        error: 'Quiz product closure failed',
        code: 'QUIZ_PRODUCT_CLOSURE_FAILED',
      },
      status: 500,
    };
  }

  if (getQuizPhaseEnv() !== 'production' || !getQuizProductionApprovedEnv()) {
    return {
      body: {
        closed: closed ?? 0,
        finalized: 0,
        skipped: 'production_not_approved',
      },
      status: 200,
    };
  }

  const { data, error } = await supabase.rpc('finalize_due_quiz_events');

  if (error) {
    console.error('Quiz finalize cron failed');
    return {
      body: { error: 'Quiz finalize failed', details: error.message },
      status: 500,
    };
  }

  return { body: { closed: closed ?? 0, finalized: data ?? 0 }, status: 200 };
}
