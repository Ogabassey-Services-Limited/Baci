import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() => vi.fn());

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

const { StorefrontDynamicMetadataMarker } = await import(
  '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker'
);

describe('StorefrontDynamicMetadataMarker', () => {
  beforeEach(() => {
    mockConnection.mockReset();
  });

  it('marks metadata routes as request-time rendered', async () => {
    mockConnection.mockResolvedValueOnce(undefined);

    await expect(StorefrontDynamicMetadataMarker()).resolves.toBeNull();

    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the surrounding route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));

    await expect(StorefrontDynamicMetadataMarker()).rejects.toThrow(
      'connection failed'
    );

    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
