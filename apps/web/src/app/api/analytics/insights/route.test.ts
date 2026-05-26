import { generateObject } from 'ai';
import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, withRetry } from '@/ai/provider';
import { hasPermission } from '@/lib/api-auth';
import { cache, generateCacheKey } from '@/lib/cache';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/ai/provider', () => ({
  AI_RATE_LIMITS: {
    insights: { requests: 5, windowMs: 60_000 },
  },
  checkRateLimit: vi.fn(),
  geminiFlash: { modelId: 'gemini-2.0-flash' },
  withRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
  generateCacheKey: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

type QueryMethod = ReturnType<typeof vi.fn>;
type TerminalMethod = 'eq' | 'order' | 'limit';

type SupabaseQuery = {
  select: QueryMethod;
  eq: QueryMethod;
  gte: QueryMethod;
  order: QueryMethod;
  limit: QueryMethod;
};

function makeQueryResult(
  terminalMethod: TerminalMethod,
  data: unknown[] = []
): SupabaseQuery {
  const promise = Promise.resolve({ data });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  } as SupabaseQuery;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query[terminalMethod].mockReturnValue(promise);

  return query;
}

function makeSupabaseMock() {
  const from = vi.fn((table: string) => {
    if (table === 'daily_sales_summary') {
      return makeQueryResult('order');
    }
    if (table === 'product_performance') {
      return makeQueryResult('limit');
    }
    return makeQueryResult('eq');
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
    from,
  };
}

describe('GET /api/analytics/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(cookies).mockResolvedValue(
      {} as Awaited<ReturnType<typeof cookies>>
    );
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock() as unknown as ReturnType<typeof createClient>
    );
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: 'merchant-1',
    } as Awaited<ReturnType<typeof getMerchantForApiRequest>>);
    vi.mocked(toUserAccess).mockReturnValue({ permissions: {} } as ReturnType<
      typeof toUserAccess
    >);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 4,
      resetIn: 60_000,
    });
    vi.mocked(generateCacheKey).mockReturnValue('ai-insights:merchant-1');
    vi.mocked(cache.get).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bounds AI insight generation below the Vercel function timeout', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        insights: [
          {
            title: 'Revenue is stable',
            description: 'Sales have stayed consistent over the last month.',
            type: 'positive',
            priority: 'medium',
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      insights: [
        {
          title: 'Revenue is stable',
        },
      ],
    });
    expect(withRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ maxRetries: 0 })
    );
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        timeout: 10_000,
      })
    );
  });

  it('returns fallback insights when the AI call times out or fails', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error('model timeout'));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      insights: [
        {
          title: 'AI Insights Temporarily Unavailable',
          type: 'neutral',
        },
      ],
    });
  });
});
