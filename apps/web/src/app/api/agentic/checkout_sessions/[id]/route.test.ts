import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyAgenticApiKey = vi.fn(() => true);

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

describe('POST /api/agentic/checkout_sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{invalid-json',
      }
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(mockVerifyAgenticApiKey).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid request body' });
  });
});
