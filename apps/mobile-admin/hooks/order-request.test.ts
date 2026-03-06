import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import {
  getAuthenticatedHeaders,
  readResponseError,
  runWithTimeout,
} from './order-request';

describe('order-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated headers when a session token exists', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    await expect(getAuthenticatedHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-123',
    });
  });

  it('throws when there is no authenticated session', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(getAuthenticatedHeaders()).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('reads API error payloads and falls back for non-JSON responses', async () => {
    const jsonResponse = {
      json: vi.fn().mockResolvedValue({ error: 'Custom API error' }),
    } as unknown as Response;
    const textResponse = {
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    } as unknown as Response;

    await expect(
      readResponseError(jsonResponse, 'Fallback error')
    ).resolves.toBe('Custom API error');
    await expect(
      readResponseError(textResponse, 'Fallback error')
    ).resolves.toBe('Fallback error');
  });

  it('maps abort errors to the provided timeout message', async () => {
    const abortError = Object.assign(new Error('Aborted'), {
      name: 'AbortError',
    });

    await expect(
      runWithTimeout(10, 'Timed out', async () => {
        throw abortError;
      })
    ).rejects.toThrow('Timed out');
  });
});
