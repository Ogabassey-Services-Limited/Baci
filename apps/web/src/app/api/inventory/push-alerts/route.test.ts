import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockInventoryPushAlertsError extends Error {
    constructor(
      message: string,
      public readonly clientMessage: string
    ) {
      super(message);
      this.name = 'InventoryPushAlertsError';
    }
  }

  return {
    InventoryPushAlertsError: MockInventoryPushAlertsError,
    sendInventoryPushAlerts: vi.fn(),
  };
});

vi.mock('@/env', () => ({
  getCronSecret: () => 'test-secret',
}));

vi.mock('@/scripts/inventory-push-alerts', () => ({
  InventoryPushAlertsError: mocks.InventoryPushAlertsError,
  sendInventoryPushAlerts: mocks.sendInventoryPushAlerts,
}));

import { GET } from './route';

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/inventory/push-alerts', {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

describe('GET /api/inventory/push-alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when cron authorization is invalid', async () => {
    const response = await GET(makeRequest('wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.sendInventoryPushAlerts).not.toHaveBeenCalled();
  });

  it('returns the inventory push summary from the shared worker', async () => {
    mocks.sendInventoryPushAlerts.mockResolvedValue({
      failed: 1,
      sent: 2,
      success: true,
      total: 3,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      failed: 1,
      sent: 2,
      success: true,
      total: 3,
    });
  });

  it('returns the client-safe error from inventory worker failures', async () => {
    mocks.sendInventoryPushAlerts.mockRejectedValue(
      new mocks.InventoryPushAlertsError(
        'Failed to fetch alerts: database unavailable',
        'Failed to fetch alerts'
      )
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch alerts',
    });
  });
});
