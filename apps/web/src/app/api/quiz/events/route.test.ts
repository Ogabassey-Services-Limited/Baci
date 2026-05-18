import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    ends_at: '2026-05-16T12:00:00.000Z',
    id: EVENT_ID,
    quiz_question_slots: [{ id: QUESTION_ID }],
    settings: { prize_name: 'N50,000 store credit' },
    starts_at: '2026-05-16T10:00:00.000Z',
    status: 'active',
    title: 'May Quiz',
    ...overrides,
  };
}

function mockAuthenticatedSupabase({
  selectResult = { data: null, error: null },
  user = { id: 'user-1' },
}: {
  selectResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const queryBuilder = {
    order: vi.fn(() => queryBuilder),
    range: vi.fn().mockResolvedValue(selectResult),
    select: vi.fn(() => queryBuilder),
  };
  const from = vi.fn(() => queryBuilder);
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

  return { from, queryBuilder };
}

function eventsRequest(query = '') {
  return new NextRequest(`http://localhost/api/quiz/events${query}`);
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('quiz events route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
            quiz_question_slots: null,
            settings: {},
            starts_at: null,
            status: 'scheduled',
          }),
          eventRow({
            id: '22222222-2222-2222-2222-222222222222',
            quiz_question_slots: undefined,
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
          questionCount: 0,
          startsAt: null,
          status: 'scheduled',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          prizeName: 'Quiz prize',
          questionCount: 0,
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

  it('lists quiz events with explicit columns and bounded pagination', async () => {
    const rows = [eventRow()];
    const { from, queryBuilder } = mockAuthenticatedSupabase({
      selectResult: { data: rows, error: null },
    });

    const { GET } = await import('./route');
    const response = await GET(eventsRequest('?limit=1&offset=2'));

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
    expect(from).toHaveBeenCalledWith('quiz_events');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'id, title, status, starts_at, ends_at, settings, quiz_question_slots(id)'
    );
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
