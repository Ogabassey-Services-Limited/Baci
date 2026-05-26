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

  it('keeps the request-time marker in a stable hidden Suspense slot', () => {
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      'aria-hidden'?: string;
      children?: unknown;
      'data-storefront-dynamic-metadata-marker'?: string;
      hidden?: boolean;
    }>;

    expect(element.type).toBe('div');
    expect(element.props.hidden).toBe(true);
    expect(element.props['aria-hidden']).toBe('true');
    expect(element.props['data-storefront-dynamic-metadata-marker']).toBe('');

    const suspenseElement = element.props.children as ReactElement<{
      children?: unknown;
      fallback?: unknown;
    }>;
    expect(suspenseElement.type).toBe(Suspense);
    expect(suspenseElement.props.fallback).toBeNull();
  });

  it('marks metadata routes as request-time rendered', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement<{ children?: ReactElement }>;
    }>;
    const suspenseElement = element.props.children;
    const connectionElement = suspenseElement?.props.children;

    await expect(
      (connectionElement?.type as () => Promise<null>)()
    ).resolves.toBeNull();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the surrounding route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));
    const element = StorefrontDynamicMetadataMarker() as ReactElement<{
      children?: ReactElement<{ children?: ReactElement }>;
    }>;
    const suspenseElement = element.props.children;
    const connectionElement = suspenseElement?.props.children;

    await expect(
      (connectionElement?.type as () => Promise<null>)()
    ).rejects.toThrow('connection failed');

    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
