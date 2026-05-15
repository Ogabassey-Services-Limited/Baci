import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { redirect } from 'next/navigation';
import AddProductPage, { metadata } from './page';

describe('dashboard add product route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the product creation dialog through the products page', () => {
    AddProductPage();

    expect(redirect).toHaveBeenCalledWith('/dashboard/products?action=new');
  });

  it('exports metadata for the compatibility route', () => {
    expect(metadata).toEqual({
      title: 'Add Product | Baci',
      description: 'Create a product in your Baci catalog',
    });
  });
});
