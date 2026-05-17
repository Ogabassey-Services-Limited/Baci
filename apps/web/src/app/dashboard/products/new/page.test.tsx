import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

const { default: NewProductPage } = await import('./page');

describe('NewProductPage', () => {
  it('redirects legacy /dashboard/products/new to /dashboard/products/add', () => {
    NewProductPage();

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/products/add');
  });
});
