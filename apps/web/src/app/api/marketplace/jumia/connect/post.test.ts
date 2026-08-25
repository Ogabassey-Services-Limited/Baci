import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { mockCheckCsrfProtection } = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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

  it('returns the CSRF failure before reading credentials', async () => {
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
  });
});
