import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const MERCHANT_ID = '55555555-5555-5555-5555-555555555555';
const MERCHANT_SLUG = 'ogabassey';

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    compliance_verified: true,
    ends_at: '2026-05-16T12:00:00.000Z',
    id: EVENT_ID,
    nlrc_permit_ref: 'NLRC-123',
    quiz_question_slots: [{ id: QUESTION_ID }],
    settings: { prize_name: 'N50,000 store credit' },
    starts_at: '2026-05-16T10:00:00.000Z',
    status: 'active',
    title: 'May Quiz',
    ...overrides,
  };
}

function mockAuthenticatedSupabase({
  customerResult = { data: { id: 'customer-1' }, error: null },
  merchantResult = { data: { id: MERCHANT_ID }, error: null },
  selectResult = { data: null, error: null },
  user = { id: 'user-1' },
}: {
  customerResult?: { data: unknown; error: unknown };
  merchantResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const customerBuilder = {
    eq: vi.fn(() => customerBuilder),
    limit: vi.fn(() => customerBuilder),
    maybeSingle: vi.fn().mockResolvedValue(customerResult),
    order: vi.fn(() => customerBuilder),
    select: vi.fn(() => customerBuilder),
  };
  const merchantBuilder = {
    eq: vi.fn(() => merchantBuilder),
    maybeSingle: vi.fn().mockResolvedValue(merchantResult),
    select: vi.fn(() => merchantBuilder),
  };
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    range: vi.fn().mockResolvedValue(selectResult),
    select: vi.fn(() => queryBuilder),
  };
  const from = vi.fn((table: string) => {
    if (table === 'customers') return customerBuilder;
    if (table === 'merchants') return merchantBuilder;
    return queryBuilder;
  });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from,
  };

  vi.mocked(createClient).mockResolvedValue(supabase as never);

  return { customerBuilder, from, merchantBuilder, queryBuilder };
}

function eventsRequest(query = '') {
  const url = new URL(`http://localhost/api/quiz/events${query}`);
  if (
    !url.searchParams.has('merchantId') &&
    !url.searchParams.has('merchantSlug')
  ) {
    url.searchParams.set('merchantId', MERCHANT_ID);
  }
  return new NextRequest(url);
}

function eventsRequestWithoutMerchant(query = '') {
  return new NextRequest(`http://localhost/api/quiz/events${query}`);
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('quiz events route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the customer is unauthenticated', async () => {
    const { from } = mockAuthenticatedSupabase({ user: null });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Unauthorized' });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 400 when pagination query values are invalid', async () => {
    const { from } = mockAuthenticatedSupabase();

    const { GET } = await import('./route');
    const response = await GET(eventsRequest('?limit=invalid'));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: 'Invalid input',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 400 when storefront merchant context is missing', async () => {
    const { from } = mockAuthenticatedSupabase();

    const { GET } = await import('./route');
    const response = await GET(eventsRequestWithoutMerchant());

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: 'Invalid input',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 404 when the requested storefront merchant is not found', async () => {
    mockAuthenticatedSupabase({
      merchantResult: { data: null, error: null },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({
      error: 'Store not found',
    });
  });

  it('returns 500 when the event query fails', async () => {
    mockAuthenticatedSupabase({
      selectResult: { data: null, error: { message: 'Database error' } },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: 'Quiz request failed',
    });
  });

  it('returns 500 when the current customer merchant lookup fails', async () => {
    mockAuthenticatedSupabase({
      customerResult: { data: null, error: { message: 'Customer error' } },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: 'Quiz request failed',
    });
  });

  it('returns an empty event list when the authenticated user is not a customer for the merchant', async () => {
    const { queryBuilder } = mockAuthenticatedSupabase({
      customerResult: { data: null, error: null },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      events: [],
      pagination: {
        hasMore: false,
        limit: 20,
        nextOffset: null,
        offset: 0,
      },
    });
    expect(queryBuilder.select).not.toHaveBeenCalled();
  });

  it('returns an empty event list with pagination defaults', async () => {
    const { queryBuilder } = mockAuthenticatedSupabase({
      selectResult: { data: [], error: null },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      events: [],
      pagination: {
        hasMore: false,
        limit: 20,
        nextOffset: null,
        offset: 0,
      },
    });
    expect(queryBuilder.range).toHaveBeenCalledWith(0, 20);
  });

  it('maps missing optional event fields to safe response defaults', async () => {
    mockAuthenticatedSupabase({
      selectResult: {
        data: [
          eventRow({
            ends_at: null,
            quiz_question_slots: [{ id: QUESTION_ID }],
            settings: {},
            starts_at: null,
            status: 'scheduled',
          }),
          eventRow({
            id: '22222222-2222-2222-2222-222222222222',
            quiz_question_slots: [{ id: QUESTION_ID }],
            settings: { prize_name: '' },
            status: 'closed',
            title: 'Closed Quiz',
          }),
        ],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest('?limit=2'));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      events: [
        {
          endsAt: null,
          prizeName: 'Quiz prize',
          questionCount: 1,
          startsAt: null,
          status: 'scheduled',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          prizeName: 'Quiz prize',
          questionCount: 1,
          status: 'closed',
          title: 'Closed Quiz',
        },
      ],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs unknown event statuses before mapping them to closed', async () => {
    mockAuthenticatedSupabase({
      selectResult: {
        data: [eventRow({ status: 'unknown_status' })],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      events: [{ status: 'closed' }],
    });
    expect(logger.warn).toHaveBeenCalledWith({
      context: 'mapQuizEventStatus',
      message: 'Unknown quiz event status mapped to closed',
      status: 'unknown_status',
    });
  });

  it('trims configured prize names before returning events', async () => {
    mockAuthenticatedSupabase({
      selectResult: {
        data: [
          eventRow({ settings: { prize_name: '  N50,000 store credit  ' } }),
        ],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      events: [{ prizeName: 'N50,000 store credit' }],
    });
  });

  it('filters out events with no question slots before returning mobile data', async () => {
    mockAuthenticatedSupabase({
      selectResult: {
        data: [
          eventRow({
            id: '22222222-2222-2222-2222-222222222222',
            quiz_question_slots: [],
          }),
          eventRow(),
        ],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest('?limit=2'));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      events: [
        {
          id: EVENT_ID,
          questionCount: 1,
        },
      ],
    });
  });

  it('fails closed in production mode when approval evidence is missing from a listed event', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    mockAuthenticatedSupabase({
      selectResult: {
        data: [
          eventRow({
            compliance_verified: false,
            nlrc_permit_ref: '',
          }),
        ],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest());

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      code: 'quiz_production_not_approved',
      error: 'Quiz prizes are not approved for production use',
    });
  });

  it('lists quiz events with explicit columns and bounded pagination', async () => {
    const rows = [eventRow()];
    const { customerBuilder, from, merchantBuilder, queryBuilder } =
      mockAuthenticatedSupabase({
        selectResult: { data: rows, error: null },
      });

    const { GET } = await import('./route');
    const response = await GET(
      eventsRequest(`?limit=1&offset=2&merchantSlug=${MERCHANT_SLUG}`)
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      events: [
        {
          endsAt: '2026-05-16T12:00:00.000Z',
          id: EVENT_ID,
          prizeName: 'N50,000 store credit',
          questionCount: 1,
          startsAt: '2026-05-16T10:00:00.000Z',
          status: 'open',
          title: 'May Quiz',
        },
      ],
      pagination: {
        hasMore: false,
        limit: 1,
        nextOffset: null,
        offset: 2,
      },
    });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('merchants');
    expect(merchantBuilder.select).toHaveBeenCalledWith('id');
    expect(merchantBuilder.eq).not.toHaveBeenCalledWith('id', MERCHANT_ID);
    expect(merchantBuilder.eq).toHaveBeenCalledWith('slug', MERCHANT_SLUG);
    expect(from).toHaveBeenCalledWith('customers');
    expect(customerBuilder.select).toHaveBeenCalledWith('id');
    expect(customerBuilder.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(customerBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(from).toHaveBeenCalledWith('quiz_events');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'id, title, status, starts_at, ends_at, settings, nlrc_permit_ref, compliance_verified, quiz_question_slots!inner(id)'
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(queryBuilder.range).toHaveBeenCalledWith(2, 3);
  });

  it('returns hasMore pagination metadata when one extra row is loaded', async () => {
    const rows = [
      eventRow(),
      eventRow({
        id: '22222222-2222-2222-2222-222222222222',
        title: 'June Quiz',
      }),
    ];
    const { queryBuilder } = mockAuthenticatedSupabase({
      selectResult: { data: rows, error: null },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest('?limit=1&offset=0'));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      events: [
        {
          endsAt: '2026-05-16T12:00:00.000Z',
          id: EVENT_ID,
          prizeName: 'N50,000 store credit',
          questionCount: 1,
          startsAt: '2026-05-16T10:00:00.000Z',
          status: 'open',
          title: 'May Quiz',
        },
      ],
      pagination: {
        hasMore: true,
        limit: 1,
        nextOffset: 1,
        offset: 0,
      },
    });
    expect(queryBuilder.range).toHaveBeenCalledWith(0, 1);
  });
});
