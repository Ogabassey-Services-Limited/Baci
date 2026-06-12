import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();
const mockGetUser = vi.fn();
const mockHeadersGet = vi.fn();

vi.mock('@/ai/provider', () => ({
  checkRateLimit: (
    identifier: string,
    config: { requests: number; windowMs: number }
  ) => mockCheckRateLimit(identifier, config),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => null,
    getAll: () => [],
    set: vi.fn(),
  }),
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ensureActionRateLimit } from './ensure-action-rate-limit';

const config = { requests: 5, windowMs: 60_000 };

describe('ensureActionRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 4,
      resetIn: 60_000,
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockHeadersGet.mockReturnValue(null);
  });

  it('binds the counter to the authenticated user id when a session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    const allowed = await ensureActionRateLimit('magic-link', config);

    expect(allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:magic-link:user-123',
      config
    );
  });

  it('falls back to the Vercel-forwarded client IP when unauthenticated', async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === 'x-vercel-forwarded-for' ? '203.0.113.7' : null
    );

    const allowed = await ensureActionRateLimit('login', config);

    expect(allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:login:203.0.113.7',
      config
    );
  });

  it('uses x-real-ip before falling back to x-forwarded-for', async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === 'x-real-ip'
        ? '198.51.100.9'
        : name === 'x-forwarded-for'
          ? '203.0.113.7, 10.0.0.1'
          : null
    );

    const allowed = await ensureActionRateLimit('login', config);

    expect(allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:login:198.51.100.9',
      config
    );
  });

  it('uses the last x-forwarded-for hop when platform headers are absent', async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '203.0.113.7, 10.0.0.1' : null
    );

    const allowed = await ensureActionRateLimit('login', config);

    expect(allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:login:10.0.0.1',
      config
    );
  });

  it('uses "unknown" when no session and no forwarded header are present', async () => {
    await ensureActionRateLimit('signup', config);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:signup:unknown',
      config
    );
  });

  it('returns false when the limiter rejects the call', async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetIn: 30_000,
    });

    const allowed = await ensureActionRateLimit('login', config);

    expect(allowed).toBe(false);
  });

  it('still counts by IP when the session lookup throws', async () => {
    mockGetUser.mockRejectedValue(new Error('supabase unavailable'));
    mockHeadersGet.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '198.51.100.4' : null
    );

    const allowed = await ensureActionRateLimit('login', config);

    expect(allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'action:login:198.51.100.4',
      config
    );
  });
});
