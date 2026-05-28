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

  it('keeps a stable hidden host around the request-time marker', () => {
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
      'aria-hidden'?: string;
      'data-storefront-dynamic-metadata-marker'?: string;
      fallback?: unknown;
      hidden?: boolean;
    }>;

    expect(element.type).toBe('div');
    expect(element.props.hidden).toBe(true);
    expect(element.props['aria-hidden']).toBe('true');
    expect(element.props['data-storefront-dynamic-metadata-marker']).toBe('');

    const suspense = element.props.children as ReactElement<{
      fallback?: unknown;
    }>;

    expect(suspense.type).toBe(Suspense);
    expect(suspense.props.fallback).toBeNull();
  });

  it('marks metadata routes as request-time rendered', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;
    const suspense = element.props.children as ReactElement<{
      children?: ReactElement;
    }>;

    await expect(
      (suspense.props.children?.type as () => Promise<null>)()
    ).resolves.toBeNull();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the surrounding route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;
    const suspense = element.props.children as ReactElement<{
      children?: ReactElement;
    }>;

    await expect(
      (suspense.props.children?.type as () => Promise<null>)()
    ).rejects.toThrow('connection failed');

    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
