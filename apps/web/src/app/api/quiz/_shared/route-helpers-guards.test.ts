import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';
import {
  enforceCashAwardPrizeGuard,
  enforceEventPrizeGuard,
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
      'nlrc_permit_ref, compliance_verified'
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
});
