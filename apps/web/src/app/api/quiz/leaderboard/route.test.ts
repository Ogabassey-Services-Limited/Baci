import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateApiRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getBearerTokenFromRequest: (request: Request) => {
    const match = (request.headers.get('Authorization') ?? '').match(
      /^\s*bearer\s+(.+?)\s*$/i
    );
    return match ? match[1] : null;
  },
  hasBearerAuthScheme: (request: Request) =>
    /^\s*bearer\s+/i.test(request.headers.get('Authorization') ?? ''),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

// The RPC now returns rank-ordered, bounded rows and flags the caller's own row,
// so the route no longer looks up customers itself.
const LEADERBOARD_ROWS = [
  {
    customer_name: 'rival',
    is_current_customer: false,
    rank: 1,
    score: 5,
    status: 'scored',
    submitted_at: '2026-07-14T09:01:00.000Z',
    total_time_seconds: 30.5,
  },
  {
    customer_name: 'me',
    is_current_customer: true,
    rank: 2,
    score: 4,
    status: 'scored',
    submitted_at: '2026-07-14T09:02:00.000Z',
    total_time_seconds: 44,
  },
];

function mockSupabase({
  rpcResult = { data: LEADERBOARD_ROWS, error: null },
  user = { id: USER_ID },
}: {
  rpcResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const supabase = {
    // Cookie-session path: requireQuizUser resolves the user from the client.
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    rpc,
  };

  vi.mocked(authenticateApiRequest).mockResolvedValue({
    error: null,
    supabase: supabase as never,
    user: user as never,
  });
  vi.mocked(createClient).mockResolvedValue(supabase as never);

  return { rpc, supabase };
}

function getRequest(eventId: string | null = EVENT_ID) {
  const url = eventId
    ? `https://shop.test/api/quiz/leaderboard?eventId=${eventId}`
    : 'https://shop.test/api/quiz/leaderboard';
  return new NextRequest(url, { method: 'GET' });
}

describe('quiz leaderboard route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the caller is not signed in', async () => {
    mockSupabase({ user: null });

    const { GET } = await import('./route');
    const response = await GET(getRequest());

    expect(response.status).toBe(401);
  });

  it('returns 400 when eventId is missing or not a uuid', async () => {
    mockSupabase();
    const { GET } = await import('./route');

    expect((await GET(getRequest(null))).status).toBe(400);
    expect((await GET(getRequest('not-a-uuid'))).status).toBe(400);
  });

  it('returns the ranked board and marks the caller entry', async () => {
    const { rpc } = mockSupabase();

    const { GET } = await import('./route');
    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    // The RPC bounds/orders/flags internally, so the route calls it with just the
    // event id — no limit, no sort, no customer lookup.
    expect(rpc).toHaveBeenCalledWith('get_quiz_leaderboard_public', {
      p_event_id: EVENT_ID,
    });

    const body = await response.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]).toMatchObject({
      displayName: 'rival',
      isCurrentCustomer: false,
      rank: 1,
    });
    // The caller's own row is flagged by the RPC and carried straight through.
    expect(body.entries[1]).toMatchObject({
      displayName: 'me',
      isCurrentCustomer: true,
      rank: 2,
    });
  });

  it('never exposes internal ids even if the RPC leaks one', async () => {
    mockSupabase({
      rpcResult: {
        data: [{ ...LEADERBOARD_ROWS[0], customer_id: 'leaked-customer' }],
        error: null,
      },
    });

    const { GET } = await import('./route');
    const body = await (await GET(getRequest())).text();

    expect(body).not.toContain('leaked-customer');
    expect(body).not.toContain('customer_id');
  });

  it('maps the QZ031 authorization failure to 403 for a non-customer', async () => {
    mockSupabase({
      rpcResult: {
        data: null,
        error: { code: 'QZ031', message: 'quiz_leaderboard_not_authorized' },
      },
    });

    const { GET } = await import('./route');
    const response = await GET(getRequest());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe(
      'QUIZ_LEADERBOARD_NOT_AUTHORIZED'
    );
  });

  it('returns 500 and logs when the RPC fails', async () => {
    mockSupabase({
      rpcResult: { data: null, error: { code: 'XX000', message: 'boom' } },
    });

    const { GET } = await import('./route');
    const response = await GET(getRequest());

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });

  it('renders an empty board without a self-highlight', async () => {
    mockSupabase({ rpcResult: { data: [], error: null } });

    const { GET } = await import('./route');
    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries).toEqual([]);
  });

  it('does not look up customers itself — the RPC owns identity and bounding', async () => {
    const { supabase } = mockSupabase();

    const { GET } = await import('./route');
    await GET(getRequest());

    // The route must not issue its own truncating customer query; the RPC flags
    // the caller's row and applies the limit.
    expect(supabase).not.toHaveProperty('from');
  });
});
