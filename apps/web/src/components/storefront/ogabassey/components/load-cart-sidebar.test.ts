import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockCartSidebarComponent = () => null;

const mockCartSidebar = vi.hoisted(() => vi.fn<MockCartSidebarComponent>());

async function importLoadCartSidebar() {
  const { loadCartSidebar } = await import('./load-cart-sidebar');

  return loadCartSidebar;
}

describe('loadCartSidebar', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCartSidebar.mockReset();
  });

  afterEach(() => {
    vi.doUnmock('@/components/storefront/ogabassey/components/CartSidebar');
  });

  it('resolves the deferred cart sidebar component', async () => {
    vi.doMock('@/components/storefront/ogabassey/components/CartSidebar', () => ({
      CartSidebar: mockCartSidebar,
    }));

    const loadCartSidebar = await importLoadCartSidebar();

    await expect(loadCartSidebar()).resolves.toBe(mockCartSidebar);
  });

  it('rejects when the deferred cart sidebar chunk fails to load', async () => {
    vi.doMock('@/components/storefront/ogabassey/components/CartSidebar', () => ({
      get CartSidebar(): MockCartSidebarComponent {
        throw new Error('cart chunk failed');
      },
    }));

    const loadCartSidebar = await importLoadCartSidebar();

    await expect(loadCartSidebar()).rejects.toThrow('cart chunk failed');
  });
});
