import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';

type QuizSupabaseQueryResult<TData = unknown> = {
  data: TData;
  error: unknown;
};

type QuizSupabaseQueryBuilder = {
  eq(column: string, value: string): QuizSupabaseQueryBuilder;
  maybeSingle(): Promise<QuizSupabaseQueryResult>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): QuizSupabaseQueryBuilder;
  range(from: number, to: number): Promise<QuizSupabaseQueryResult>;
  select(columns: string): QuizSupabaseQueryBuilder;
};

export type ServerSupabaseClient = {
  auth: {
    getUser(): Promise<{
      data: { user: User | null };
      error: unknown;
    }>;
  };
  from(table: string): QuizSupabaseQueryBuilder;
  rpc(
    functionName: string,
    args?: Record<string, unknown>
  ): Promise<QuizSupabaseQueryResult>;
};

type QuizAwardPrizeGuardEventRow = {
  compliance_verified?: boolean | null;
  nlrc_permit_ref?: string | null;
};

type QuizAwardPrizeGuardRow = {
  quiz_events?:
    | QuizAwardPrizeGuardEventRow
    | QuizAwardPrizeGuardEventRow[]
    | null;
};

export async function enforceEventPrizeGuard(
  supabase: ServerSupabaseClient,
  eventId: string
) {
  const { data, error } = await supabase
    .from('quiz_events')
    .select('nlrc_permit_ref, compliance_verified')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'Quiz event prize guard lookup failed',
      error,
      eventId,
    });
    throw new Error(`Quiz event prize guard lookup failed for ${eventId}`);
  }

  const eventRow = data as QuizAwardPrizeGuardEventRow | null;
  if (!eventRow) {
    logger.warn({
      message: 'Quiz event prize guard missing event row',
      eventId,
    });
  }

  // Fail closed for missing rows: production prize flows require positive
  // compliance evidence from the event row.
  enforcePrizeProductionGuard(
    {
      nlrc_permit_ref:
        typeof eventRow?.nlrc_permit_ref === 'string'
          ? eventRow.nlrc_permit_ref
          : null,
    },
    eventRow?.compliance_verified === true
  );
}

export async function enforceCashAwardPrizeGuard(
  supabase: ServerSupabaseClient,
  awardId: string
) {
  const { data, error } = await supabase
    .from('quiz_awards')
    .select('quiz_events(nlrc_permit_ref, compliance_verified)')
    .eq('id', awardId)
    .maybeSingle();
  if (error) {
    logger.error({
      message: 'Quiz cash award prize guard lookup failed',
      awardId,
      error,
    });
    throw new Error(`Quiz cash award prize guard lookup failed for ${awardId}`);
  }

  const awardRow = data as QuizAwardPrizeGuardRow | null;
  if (!awardRow) {
    logger.warn({
      message: 'Quiz cash award prize guard missing award row',
      awardId,
    });
  }
  // Supabase foreign-key joins can still return arrays; normalize the
  // awardRow?.quiz_events join shape through rawEventRow before guard checks.
  const rawEventRow = awardRow?.quiz_events;
  const eventRow = Array.isArray(rawEventRow) ? rawEventRow[0] : rawEventRow;
  if (
    rawEventRow !== undefined &&
    rawEventRow !== null &&
    typeof rawEventRow !== 'object'
  ) {
    logger.warn({
      message: 'Quiz cash award prize guard unexpected event join shape',
      awardId,
      joinType: typeof rawEventRow,
    });
  }

  // Fail closed: nullable event fields cannot satisfy production guard checks.
  enforcePrizeProductionGuard(
    {
      nlrc_permit_ref:
        typeof eventRow?.nlrc_permit_ref === 'string'
          ? eventRow.nlrc_permit_ref
          : null,
    },
    eventRow?.compliance_verified === true
  );
}
