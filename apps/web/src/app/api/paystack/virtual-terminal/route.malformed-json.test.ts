import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  createVirtualTerminal: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getUser: vi.fn(),
}));

const supabase = { auth: { getUser: mocks.getUser } };

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({})) }));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  hasPermission: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: vi.fn(),
}));
vi.mock('@/lib/paystack', () => ({
  createVirtualTerminal: mocks.createVirtualTerminal,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { POST } from './route';

describe('POST /api/paystack/virtual-terminal malformed JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: true,
      response: null,
    });
    mocks.createClient.mockReturnValue(supabase);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('returns a client error before merchant resolution when the authenticated body is malformed', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const response = await POST(
        new NextRequest('https://usebaci.com/api/paystack/virtual-terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid JSON body',
      });
      expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
      expect(mocks.createVirtualTerminal).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
