import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

// =============================================================================
// Mocks
// =============================================================================

const mockNotifyNegotiationRequest = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/expo-push', () => ({
  notifyNegotiationRequest: (...args: unknown[]) =>
    mockNotifyNegotiationRequest(...args),
}));

// =============================================================================
// Helpers
// =============================================================================

function createRequest(
  body: Record<string, unknown>,
  secret = 'test-internal-secret'
): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/internal/notify-negotiation',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
    }
  );
}

const validBody = {
  merchantId: '868f0fdc-5654-469b-9807-695ca1206d20',
  negotiationType: 'single',
  offeredPrice: 5000,
  negotiationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  itemName: 'Test Product',
  currentPrice: 10000,
};

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/internal/notify-negotiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
  });

  it('returns 401 when Authorization header is missing', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/internal/notify-negotiation',
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when secret is invalid', async () => {
    const request = createRequest(validBody, 'wrong-secret');
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    const request = createRequest({ merchantId: 'not-a-uuid' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });

  it('calls notifyNegotiationRequest with correct args for single type', async () => {
    const request = createRequest(validBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockNotifyNegotiationRequest).toHaveBeenCalledWith(
      validBody.merchantId,
      'single',
      5000,
      validBody.negotiationId,
      'Test Product',
      10000
    );
  });

  it('returns 500 when notifyNegotiationRequest rejects', async () => {
    mockNotifyNegotiationRequest.mockRejectedValueOnce(
      new Error('Push service unavailable')
    );
    const request = createRequest(validBody);

    await expect(POST(request)).rejects.toThrow('Push service unavailable');
  });

  it('calls notifyNegotiationRequest with nulls for total type', async () => {
    const request = createRequest({
      ...validBody,
      negotiationType: 'total',
      itemName: null,
      currentPrice: null,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockNotifyNegotiationRequest).toHaveBeenCalledWith(
      validBody.merchantId,
      'total',
      5000,
      validBody.negotiationId,
      null,
      null
    );
  });
});
