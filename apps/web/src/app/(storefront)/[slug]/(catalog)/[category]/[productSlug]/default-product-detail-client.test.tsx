import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';

const mockDynamic = vi.hoisted(() => vi.fn());
const mockProductDetailClient = vi.hoisted(() =>
  vi.fn<(props: unknown) => null>(() => null)
);

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    mockDynamic(loader);

    return (props: unknown) => mockProductDetailClient(props);
  },
}));

import { DefaultProductDetailClient } from './default-product-detail-client';

describe('DefaultProductDetailClient', () => {
  it('keeps the generic product client behind a dynamic loader', () => {
    const product = { id: 'prod-1', name: 'Generic Phone' } as Product;

    render(<DefaultProductDetailClient product={product} />);

    expect(mockDynamic).toHaveBeenCalledWith(expect.any(Function));
    expect(mockProductDetailClient).toHaveBeenCalledWith({ product });
  });
});
