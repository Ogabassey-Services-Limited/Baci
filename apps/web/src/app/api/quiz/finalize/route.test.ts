import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ finalize: vi.fn() }));
vi.mock('@/env', () => ({ getCronSecret: () => process.env.CRON_SECRET }));
vi.mock('@/lib/quiz/finalize-due-quiz-events', () => ({
  finalizeDueQuizEvents: mocks.finalize,
}));

import { GET } from './route';

function request(authorization?: string) {
  return new NextRequest('http://localhost/api/quiz/finalize', {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe('GET /api/quiz/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mocks.finalize.mockResolvedValue({
      body: { testClosed: 2, awarded: 0 },
      status: 200,
    });
  });

  it('fails closed when the cron secret is missing', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request('Bearer cron-secret'));
    expect(response.status).toBe(500);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid authorization', async () => {
    await expect(
      GET(request()).then((response) => response.status)
    ).resolves.toBe(401);
    await expect(
      GET(request('Bearer wrong')).then((response) => response.status)
    ).resolves.toBe(401);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('uses the shared direct-worker helper and returns its bounded summary', async () => {
    const response = await GET(request('Bearer cron-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ testClosed: 2, awarded: 0 });
    expect(mocks.finalize).toHaveBeenCalledOnce();
  });
});
