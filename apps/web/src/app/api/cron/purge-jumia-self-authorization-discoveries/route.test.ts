import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateAnonClient, mockPurge } = vi.hoisted(() => ({
  mockCreateAnonClient: vi.fn<() => object>(() => ({})),
  mockPurge: vi.fn(),
}));

vi.mock('@/env', () => ({
  getCronSecret: () => 'cron-secret',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mockCreateAnonClient,
}));

vi.mock(
  '@/lib/jumia/purge-expired-jumia-self-authorization-discoveries',
  () => ({
    purgeExpiredJumiaSelfAuthorizationDiscoveries: (...args: unknown[]) =>
      mockPurge(...args),
  })
);

import { GET } from './route';

describe('purge Jumia self-authorization discoveries cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPurge.mockResolvedValue(3);
    mockCreateAnonClient.mockReturnValue({});
  });

  it('returns 401 without the cron secret', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/purge-jumia-self-authorization-discoveries'
      )
    );
    expect(response.status).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
    expect(mockCreateAnonClient).not.toHaveBeenCalled();
  });

  it('purges expired discoveries when authorized', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/purge-jumia-self-authorization-discoveries',
        {
          headers: { Authorization: 'Bearer cron-secret' },
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: 3 });
    expect(mockPurge).toHaveBeenCalledTimes(1);
    expect(mockPurge).toHaveBeenCalledWith(
      mockCreateAnonClient.mock.results[0]?.value
    );
  });

  it('returns 500 when the scoped purge RPC fails', async () => {
    mockPurge.mockRejectedValueOnce(new Error('RPC unavailable'));

    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/purge-jumia-self-authorization-discoveries',
        {
          headers: { Authorization: 'Bearer cron-secret' },
        }
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Purge failed' });
  });
});
