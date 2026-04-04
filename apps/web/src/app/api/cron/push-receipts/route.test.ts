import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// =============================================================================
// Mocks
// =============================================================================

const { mockGetReceipts } = vi.hoisted(() => ({
  mockGetReceipts: vi.fn(),
}));

vi.mock('expo-server-sdk', () => {
  const mockChunkIds = vi.fn((ids: string[]) => [ids]);

  class MockExpo {
    getPushNotificationReceiptsAsync = mockGetReceipts;
    chunkPushNotificationReceiptIds = mockChunkIds;
  }

  return { Expo: MockExpo, default: MockExpo };
});

const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockTicketIn = vi.fn().mockResolvedValue({ error: null });
const mockTokenIn = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn().mockResolvedValue({ error: null });
let mockSelectResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
  getExpoAccessToken: () => process.env.EXPO_ACCESS_TOKEN,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'push_notification_tickets') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockSelectResult),
              }),
            }),
          }),
          update: vi.fn((data: unknown) => {
            mockUpdate(data);
            return {
              eq: mockEq,
              in: mockTicketIn,
            };
          }),
        };
      }
      if (table === 'push_tokens') {
        return {
          update: vi.fn().mockReturnValue({ in: mockTokenIn }),
        };
      }
      return {};
    }),
    rpc: mockRpc,
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

function createCronRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/push-receipts', {
    method: 'GET',
    headers: { Authorization: 'Bearer test-cron-secret' },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/cron/push-receipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.EXPO_ACCESS_TOKEN = 'test-expo-token';
    mockSelectResult = { data: [], error: null };
  });

  it('returns 401 when Authorization header is missing', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/cron/push-receipts',
      { method: 'GET' }
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when Authorization header is invalid', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/cron/push-receipts',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer wrong-secret' },
      }
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns checked: 0 when no pending tickets', async () => {
    mockSelectResult = { data: [], error: null };
    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checked).toBe(0);
    expect(data.cleaned).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_push_tickets');
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(createCronRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: 'Server misconfigured' });
  });

  it('returns 500 when fetch errors', async () => {
    mockSelectResult = { data: null, error: { message: 'DB error' } };
    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Database read error' });
    // Cleanup is NOT called on fetch error — only runs after successful processing
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('processes delivered receipts and updates status', async () => {
    mockSelectResult = {
      data: [
        {
          id: 'row-1',
          ticket_id: 'ticket-1',
          push_token: 'ExponentPushToken[abc]',
        },
      ],
      error: null,
    };

    mockGetReceipts.mockResolvedValue({
      'ticket-1': { status: 'ok' },
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checked).toBe(1);
    expect(data.delivered).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.chunkFailures).toBe(0);
    expect(data.cleaned).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered' })
    );
    expect(mockTicketIn).toHaveBeenCalledWith('id', ['row-1']);
    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_push_tickets');
  });

  it('returns 207 when a chunk fails', async () => {
    mockSelectResult = {
      data: [
        {
          id: 'row-1',
          ticket_id: 'ticket-1',
          push_token: 'ExponentPushToken[abc]',
        },
      ],
      error: null,
    };

    mockGetReceipts.mockRejectedValue(new Error('Expo API down'));

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(207);
    expect(data.chunkFailures).toBe(1);
    expect(data.checked).toBe(1);
    expect(data.delivered).toBe(0);
    expect(data.failed).toBe(0);
    expect(data.cleaned).toBe(true);
  });

  it('deactivates tokens for DeviceNotRegistered errors', async () => {
    mockSelectResult = {
      data: [
        {
          id: 'row-2',
          ticket_id: 'ticket-2',
          push_token: 'ExponentPushToken[expired]',
        },
      ],
      error: null,
    };

    mockGetReceipts.mockResolvedValue({
      'ticket-2': {
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(data.failed).toBe(1);
    expect(mockTokenIn).toHaveBeenCalledWith('token', [
      'ExponentPushToken[expired]',
    ]);
  });

  it('reports cleaned: false when cleanup RPC fails on empty results', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } });
    mockSelectResult = { data: [], error: null };

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checked).toBe(0);
    expect(data.cleaned).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_push_tickets');
  });
});
