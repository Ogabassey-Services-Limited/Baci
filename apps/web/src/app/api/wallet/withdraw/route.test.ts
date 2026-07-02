import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { POST } from './route';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

describe('POST /api/wallet/withdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when CSRF is valid because withdrawals are disabled', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: 'Not found' });
  });

  it('returns 403 when CSRF is invalid', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: 'CSRF validation failed' });
  });
});
