import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';

type QuizSupabaseQueryResult<TData = unknown> = {
  data: TData;
  error: unknown;
};

type QuizSupabaseQueryBuilder = {
  eq(column: string, value: string): QuizSupabaseQueryBuilder;
  limit(count: number): QuizSupabaseQueryBuilder;
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
  merchant_id?: string | null;
  nlrc_permit_ref?: string | null;
};

type QuizAwardPrizeGuardRow = {
  quiz_events?:
    | QuizAwardPrizeGuardEventRow
    | QuizAwardPrizeGuardEventRow[]
    | null;
};

const QUIZ_MINIMUM_AGE_YEARS = 18;

export class QuizAgeGateError extends Error {
  readonly code = 'quiz_age_restricted';
  readonly status = 403;
}

function parseDateOfBirth(dateOfBirth: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function calculateAgeYears(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDelta = now.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age;
}

export async function enforceEventPrizeGuard(
  supabase: ServerSupabaseClient,
  eventId: string
) {
  const { data, error } = await supabase
    .from('quiz_events')
    .select('merchant_id, nlrc_permit_ref, compliance_verified')
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

  return {
    merchantId:
      typeof eventRow?.merchant_id === 'string' ? eventRow.merchant_id : null,
  };
}

export async function enforceQuizAgeGate(
  supabase: ServerSupabaseClient,
  merchantId: string | null,
  userId: string
) {
  if (!merchantId) {
    logger.warn({
      message: 'Quiz age gate missing merchant context',
      userId,
    });
    throw new QuizAgeGateError('Quiz age verification requires merchant scope');
  }

  const { data, error } = await supabase
    .from('customers')
    .select('date_of_birth')
    .eq('merchant_id', merchantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error({
      error,
      merchantId,
      message: 'Quiz age gate customer lookup failed',
      userId,
    });
    throw new Error(`Quiz age gate customer lookup failed for ${userId}`);
  }

  const customer = data as { date_of_birth?: string | null } | null;
  const dateOfBirth =
    typeof customer?.date_of_birth === 'string' ? customer.date_of_birth : null;
  const parsedDate = dateOfBirth ? parseDateOfBirth(dateOfBirth) : null;

  if (!parsedDate) {
    logger.warn({
      merchantId,
      message: 'Quiz age gate missing or invalid date_of_birth',
      userId,
    });
    throw new QuizAgeGateError('Quiz participation requires date of birth');
  }

  if (calculateAgeYears(parsedDate, new Date()) < QUIZ_MINIMUM_AGE_YEARS) {
    logger.warn({
      merchantId,
      message: 'Quiz age gate blocked underage customer',
      userId,
    });
    throw new QuizAgeGateError('Quiz participation is age restricted');
  }
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
