import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';
import {
  enforceCashAwardPrizeGuard,
  enforceEventPrizeGuard,
  enforceQuizAgeGate,
  QuizAgeGateError,
  type ServerSupabaseClient,
} from './route-helpers-guards';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/quiz-compliance-gate', () => ({
  enforcePrizeProductionGuard: vi.fn(),
}));

function mockSupabaseResult(result: { data: unknown; error: unknown }) {
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn(() => queryBuilder),
    range: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => queryBuilder),
  };
  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn(),
  } as unknown as ServerSupabaseClient;

  return { queryBuilder, supabase };
}

describe('quiz route helper prize guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks event compliance evidence for event prize guards', async () => {
    const { queryBuilder, supabase } = mockSupabaseResult({
      data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-123' },
      error: null,
    });

    await enforceEventPrizeGuard(supabase, 'event-1');

    expect(supabase.from).toHaveBeenCalledWith('quiz_events');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'merchant_id, nlrc_permit_ref, compliance_verified'
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'event-1');
    expect(enforcePrizeProductionGuard).toHaveBeenCalledWith(
      { nlrc_permit_ref: 'NLRC-123' },
      true
    );
  });

  it('throws and logs event guard query errors', async () => {
    const dbError = new Error('event query failed');
    const { supabase } = mockSupabaseResult({ data: null, error: dbError });

    await expect(enforceEventPrizeGuard(supabase, 'event-1')).rejects.toThrow(
      'Quiz event prize guard lookup failed for event-1'
    );

    expect(logger.error).toHaveBeenCalledWith({
      error: dbError,
      eventId: 'event-1',
      message: 'Quiz event prize guard lookup failed',
    });
    expect(enforcePrizeProductionGuard).not.toHaveBeenCalled();
  });

  it('fails closed and logs when event guard rows are missing', async () => {
    const { supabase } = mockSupabaseResult({ data: null, error: null });

    await enforceEventPrizeGuard(supabase, 'event-missing');

    expect(logger.warn).toHaveBeenCalledWith({
      eventId: 'event-missing',
      message: 'Quiz event prize guard missing event row',
    });
    expect(enforcePrizeProductionGuard).toHaveBeenCalledWith(
      { nlrc_permit_ref: null },
      false
    );
  });

  it('checks cash award joined event compliance evidence', async () => {
    const { queryBuilder, supabase } = mockSupabaseResult({
      data: {
        quiz_events: { compliance_verified: true, nlrc_permit_ref: 'NLRC-456' },
      },
      error: null,
    });

    await enforceCashAwardPrizeGuard(supabase, 'award-1');

    expect(supabase.from).toHaveBeenCalledWith('quiz_awards');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'quiz_events(nlrc_permit_ref, compliance_verified)'
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'award-1');
    expect(enforcePrizeProductionGuard).toHaveBeenCalledWith(
      { nlrc_permit_ref: 'NLRC-456' },
      true
    );
  });

  it('throws and logs cash award query errors', async () => {
    const dbError = new Error('award query failed');
    const { supabase } = mockSupabaseResult({ data: null, error: dbError });

    await expect(
      enforceCashAwardPrizeGuard(supabase, 'award-1')
    ).rejects.toThrow('Quiz cash award prize guard lookup failed for award-1');

    expect(logger.error).toHaveBeenCalledWith({
      awardId: 'award-1',
      error: dbError,
      message: 'Quiz cash award prize guard lookup failed',
    });
    expect(enforcePrizeProductionGuard).not.toHaveBeenCalled();
  });

  it('fails closed for missing cash award rows', async () => {
    const { supabase } = mockSupabaseResult({ data: null, error: null });

    await enforceCashAwardPrizeGuard(supabase, 'award-1');

    expect(logger.warn).toHaveBeenCalledWith({
      awardId: 'award-1',
      message: 'Quiz cash award prize guard missing award row',
    });
    expect(enforcePrizeProductionGuard).toHaveBeenCalledWith(
      { nlrc_permit_ref: null },
      false
    );
  });

  it('handles unexpected and array event join shapes', async () => {
    const primitive = mockSupabaseResult({
      data: { quiz_events: 'bad-shape' },
      error: null,
    });

    await enforceCashAwardPrizeGuard(primitive.supabase, 'award-primitive');

    expect(logger.warn).toHaveBeenCalledWith({
      awardId: 'award-primitive',
      joinType: 'string',
      message: 'Quiz cash award prize guard unexpected event join shape',
    });
    expect(enforcePrizeProductionGuard).toHaveBeenLastCalledWith(
      { nlrc_permit_ref: null },
      false
    );

    const arrayJoin = mockSupabaseResult({
      data: {
        quiz_events: [
          { compliance_verified: true, nlrc_permit_ref: 'NLRC-789' },
        ],
      },
      error: null,
    });

    await enforceCashAwardPrizeGuard(arrayJoin.supabase, 'award-array');

    expect(enforcePrizeProductionGuard).toHaveBeenLastCalledWith(
      { nlrc_permit_ref: 'NLRC-789' },
      true
    );
  });

  it('rejects quiz age gate checks without merchant scope', async () => {
    const { supabase } = mockSupabaseResult({
      data: { date_of_birth: '1990-01-01' },
      error: null,
    });

    await expect(
      enforceQuizAgeGate(supabase, null, 'user-1')
    ).rejects.toBeInstanceOf(QuizAgeGateError);

    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Quiz age gate missing merchant context',
      userId: 'user-1',
    });
  });

  it('rejects quiz age gate when date of birth is missing', async () => {
    const { queryBuilder, supabase } = mockSupabaseResult({
      data: { date_of_birth: null },
      error: null,
    });

    await expect(
      enforceQuizAgeGate(supabase, 'merchant-1', 'user-1')
    ).rejects.toBeInstanceOf(QuizAgeGateError);

    expect(supabase.from).toHaveBeenCalledWith('customers');
    expect(queryBuilder.select).toHaveBeenCalledWith('date_of_birth');
    expect(queryBuilder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(queryBuilder.limit).toHaveBeenCalledWith(1);
    expect(logger.warn).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      message: 'Quiz age gate missing or invalid date_of_birth',
      userId: 'user-1',
    });
  });

  it('rejects quiz age gate when the customer is underage', async () => {
    const { supabase } = mockSupabaseResult({
      data: { date_of_birth: '2012-01-01' },
      error: null,
    });

    await expect(
      enforceQuizAgeGate(supabase, 'merchant-1', 'user-1')
    ).rejects.toBeInstanceOf(QuizAgeGateError);

    expect(logger.warn).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      message: 'Quiz age gate blocked underage customer',
      userId: 'user-1',
    });
  });

  it('throws and logs age gate lookup failures', async () => {
    const dbError = new Error('customer lookup failed');
    const { supabase } = mockSupabaseResult({ data: null, error: dbError });

    await expect(
      enforceQuizAgeGate(supabase, 'merchant-1', 'user-1')
    ).rejects.toThrow('Quiz age gate customer lookup failed for user-1');

    expect(logger.error).toHaveBeenCalledWith({
      error: dbError,
      merchantId: 'merchant-1',
      message: 'Quiz age gate customer lookup failed',
      userId: 'user-1',
    });
  });

  it('passes age gate checks for adults', async () => {
    const { supabase } = mockSupabaseResult({
      data: { date_of_birth: '1990-05-01' },
      error: null,
    });

    await expect(
      enforceQuizAgeGate(supabase, 'merchant-1', 'user-1')
    ).resolves.toBeUndefined();
  });
});
