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

  it('keeps the request-time marker behind Suspense', () => {
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: unknown;
      fallback?: unknown;
    }>;

    expect(element.type).toBe(Suspense);
    expect(element.props.fallback).toBeNull();
  });

  it('marks metadata routes as request-time rendered', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;
    const connectionElement = element.props.children;

    await expect(
      (connectionElement?.type as () => Promise<null>)()
    ).resolves.toBeNull();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the surrounding route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement;
    }>;
    const connectionElement = element.props.children;

    await expect(
      (connectionElement?.type as () => Promise<null>)()
    ).rejects.toThrow('connection failed');

    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
