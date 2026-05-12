import type { ComponentType } from 'react';

export async function loadCartSidebar(): Promise<ComponentType> {
  const { CartSidebar } = await import(
    '@/components/storefront/ogabassey/components/CartSidebar'
  );

  return CartSidebar;
}
