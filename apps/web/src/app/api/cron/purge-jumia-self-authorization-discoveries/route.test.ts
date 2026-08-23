import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateServiceClient, mockPurge, mockSweep } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn<() => object>(() => ({})),
  mockPurge: vi.fn(),
  mockSweep: vi.fn(),
}));

vi.mock('@/env', () => ({
  getCronSecret: () => 'cron-secret',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock(
  '@/lib/jumia/purge-expired-jumia-self-authorization-discoveries',
  () => ({
    purgeExpiredJumiaSelfAuthorizationDiscoveries: (...args: unknown[]) =>
      mockPurge(...args),
  })
);

vi.mock('@/lib/jumia/purge-orphaned-jumia-authorizations', () => ({
  purgeOrphanedJumiaAuthorizations: (...args: unknown[]) => mockSweep(...args),
}));

import { GET } from './route';

describe('purge Jumia self-authorization discoveries cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPurge.mockResolvedValue(3);
    mockSweep.mockResolvedValue(1);
    mockCreateServiceClient.mockReturnValue({});
  });

  it('returns 401 without the cron secret', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/purge-jumia-self-authorization-discoveries'
      )
    );
    expect(response.status).toBe(401);
    expect(mockPurge).not.toHaveBeenCalled();
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
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
    await expect(response.json()).resolves.toEqual({ deleted: 3, orphaned: 1 });
    expect(mockPurge).toHaveBeenCalledTimes(1);
    expect(mockPurge).toHaveBeenCalledWith(
      mockCreateServiceClient.mock.results[0]?.value
    );
    expect(mockSweep).toHaveBeenCalledWith(
      mockCreateServiceClient.mock.results[0]?.value
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

  it('returns 500 when the orphan sweep fails', async () => {
    mockSweep.mockRejectedValueOnce(new Error('RPC unavailable'));

    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/purge-jumia-self-authorization-discoveries',
        { headers: { Authorization: 'Bearer cron-secret' } }
      )
    );

    expect(response.status).toBe(500);
  });
});
