import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { mockCheckCsrfProtection, mockGetUser } = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { createJumiaConnectPost } from './post';

describe('createJumiaConnectPost', () => {
  it('creates the handler without reading credentials eagerly', () => {
    const getAppUrl = vi.fn();
    const getClientId = vi.fn();
    const getEncryptionKey = vi.fn();

    expect(
      createJumiaConnectPost({ getAppUrl, getClientId, getEncryptionKey })
    ).toBeTypeOf('function');
    expect(getAppUrl).not.toHaveBeenCalled();
    expect(getClientId).not.toHaveBeenCalled();
    expect(getEncryptionKey).not.toHaveBeenCalled();
  });

  it('authenticates before CSRF and does not read credentials on CSRF failure', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'merchant-1' } },
      error: null,
    });
    mockCheckCsrfProtection.mockResolvedValueOnce({ valid: false });
    const getAppUrl = vi.fn();
    const getClientId = vi.fn();
    const getEncryptionKey = vi.fn();
    const handler = createJumiaConnectPost({
      getAppUrl,
      getClientId,
      getEncryptionKey,
    });

    const response = await handler(
      new NextRequest(
        'https://usebaci.com/api/marketplace/jumia/connect?connectionType=oauth',
        { method: 'POST' }
      )
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(getAppUrl).not.toHaveBeenCalled();
    expect(getClientId).not.toHaveBeenCalled();
    expect(getEncryptionKey).not.toHaveBeenCalled();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockCheckCsrfProtection.mock.invocationCallOrder[0]
    );
  });
});
