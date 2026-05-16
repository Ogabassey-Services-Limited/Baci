import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createAdminClient } from '@/lib/supabase/admin';

const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({ id: 'merchant-1', slug: 'ogabassey' })
);

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: vi.fn(() => true),
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/agentic/idempotency', () => ({
  reserveAgenticIdempotencyKey: vi.fn(),
}));

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));

vi.mock('@/lib/agentic/request-integrity', () => ({
  AGENTIC_REQUEST_INTEGRITY_ERRORS: {
    INVALID_REQUEST_ID_FORMAT: 'Invalid request ID format',
    INVALID_TIMESTAMP: 'Invalid timestamp',
    MISSING_SIGNING_SECRET: 'Missing signing secret',
    REQUEST_ID_TOO_LONG: 'Request ID too long',
    STALE_TIMESTAMP: 'Stale timestamp',
    UNSUPPORTED_API_VERSION: 'Unsupported api version',
  },
  getAgenticSigningSecrets: vi.fn(() => ['signing-secret']),
  verifyAgenticRequestIntegrity: vi.fn(() => ({
    apiVersion: '2026-04-30',
    ok: true,
    requestId: 'req_123',
  })),
}));

vi.mock('@/lib/agentic/request-replay', () => ({
  reserveAgenticRequestId: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

describe('POST /api/agentic/checkout_sessions idempotency replay ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    vi.mocked(createAdminClient).mockReturnValue({} as never);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({} as never);
  });

  it('replays a stored idempotency result before checking request replay', async () => {
    vi.mocked(reserveAgenticIdempotencyKey).mockResolvedValue({
      ok: true,
      response: { id: 'agentic_session_1', status: 'ready_for_payment' },
      state: 'replay',
      status: 201,
    });
    vi.mocked(reserveAgenticRequestId).mockResolvedValue({
      error: 'Replay request id',
      ok: false,
    });

    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/agentic/checkout_sessions', {
        body: JSON.stringify({
          currency: 'ngn',
          items: [{ id: 'product-1', quantity: 1 }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: 'agentic_session_1',
      status: 'ready_for_payment',
    });
    expect(reserveAgenticRequestId).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });
});
