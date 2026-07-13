import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  resolveRepairsCatalogMerchant: vi.fn(),
  getRepairDeviceDetailBySlug: vi.fn(),
}));

vi.mock('@/lib/repairs/repairs-catalog-access', () => ({
  resolveRepairsCatalogMerchant: mocks.resolveRepairsCatalogMerchant,
}));

vi.mock('@/lib/repairs/repairs-catalog-data', () => ({
  getRepairDeviceDetailBySlug: mocks.getRepairDeviceDetailBySlug,
}));

const request = {} as unknown as NextRequest;

const params = (slug: string, deviceSlug: string) =>
  Promise.resolve({ slug, deviceSlug });

describe('GET /api/storefront/[slug]/repairs/devices/[deviceSlug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRepairsCatalogMerchant.mockResolvedValue({
      merchantId: 'merchant-1',
      enabled: true,
    });
    mocks.getRepairDeviceDetailBySlug.mockResolvedValue({
      device: { id: 'd1' },
      quotes: [],
      product: null,
    });
  });

  it('returns 400 for an invalid device slug', async () => {
    const response = await GET(request, {
      params: params('ogabassey', 'Not A Slug'),
    });

    expect(response.status).toBe(400);
    expect(mocks.resolveRepairsCatalogMerchant).not.toHaveBeenCalled();
  });

  it('returns 404 when the repairs catalogue is disabled', async () => {
    mocks.resolveRepairsCatalogMerchant.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      enabled: false,
    });

    const response = await GET(request, {
      params: params('ogabassey', 'iphone-13'),
    });

    expect(response.status).toBe(404);
    expect(mocks.getRepairDeviceDetailBySlug).not.toHaveBeenCalled();
  });

  it('returns 404 when the device is not found', async () => {
    mocks.getRepairDeviceDetailBySlug.mockResolvedValueOnce(null);

    const response = await GET(request, {
      params: params('ogabassey', 'iphone-13'),
    });

    expect(response.status).toBe(404);
  });

  it('returns the device detail payload', async () => {
    const detail = {
      device: { id: 'd1', slug: 'iphone-13' },
      quotes: [{ id: 'q1', serviceTypeName: 'Screen Replacement' }],
      product: null,
    };
    mocks.getRepairDeviceDetailBySlug.mockResolvedValueOnce(detail);

    const response = await GET(request, {
      params: params('ogabassey', 'iphone-13'),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(detail);
    expect(mocks.getRepairDeviceDetailBySlug).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-13'
    );
  });

  it('returns 500 when the data layer throws', async () => {
    mocks.getRepairDeviceDetailBySlug.mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await GET(request, {
        params: params('ogabassey', 'iphone-13'),
      });

      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
