import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/platform-admin-auth', () => {
  return {
    getPlatformAdminAuth: vi
      .fn()
      .mockResolvedValue({ status: 'unauthenticated' }),
  };
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/hero-image-generator', () => ({
  generateHeroImageBatch: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

describe('/api/admin/generate-hero-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET should return 401 when unauthenticated', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('POST should return 401 when unauthenticated', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      { method: 'POST' }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
