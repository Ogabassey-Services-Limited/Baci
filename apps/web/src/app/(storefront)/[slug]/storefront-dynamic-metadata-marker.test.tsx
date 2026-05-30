import { type ReactElement, Suspense } from 'react';
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

  it('keeps the request-time marker inside a stable Suspense host slot', () => {
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
      fallback?: ReactElement;
    }>;

    expect(element.type).toBe(Suspense);
    expect(element.props.fallback?.type).toBe('div');
    expect(element.props.fallback?.props).toEqual({
      'aria-hidden': 'true',
      'data-storefront-dynamic-metadata-marker': '',
      hidden: true,
    });
  });

  it('marks metadata routes as request-time rendered', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    const suspense = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;

    const resolvedMarker = await (
      suspense.props.children?.type as () => Promise<ReactElement>
    )();

    expect(resolvedMarker.type).toBe('div');
    expect(resolvedMarker.props).toEqual({
      'aria-hidden': 'true',
      'data-storefront-dynamic-metadata-marker': '',
      hidden: true,
    });
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the surrounding route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));
    const suspense = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;

    await expect(
      (suspense.props.children?.type as () => Promise<null>)()
    ).rejects.toThrow('connection failed');

    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
