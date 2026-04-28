import { getEffectiveStock, type ManagedStockLike } from '@/lib/product-stock';

export type StorefrontAgentAvailability = {
  availability: 'in_stock' | 'out_of_stock';
  inventory_policy: 'tracked' | 'untracked';
  is_purchasable: boolean;
  quantity_available: number | null;
  stock: number;
};

export function coerceStorefrontManageStock(
  value: ManagedStockLike['manage_stock']
): boolean {
  // Storefront read contract: null or missing stock tracking means unmanaged
  // inventory, which is treated as available without a finite quantity.
  return !(value === false || value == null);
}

export function isUnmanagedStock(
  product: Pick<ManagedStockLike, 'manage_stock'>
): boolean {
  return coerceStorefrontManageStock(product.manage_stock) === false;
}

export function getStorefrontAgentAvailability(
  product: ManagedStockLike
): StorefrontAgentAvailability {
  const stock = getEffectiveStock(product);

  if (isUnmanagedStock(product)) {
    return {
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock,
    };
  }

  const isPurchasable = stock > 0;
  const quantityAvailable = Math.max(0, stock);

  return {
    availability: isPurchasable ? 'in_stock' : 'out_of_stock',
    inventory_policy: 'tracked',
    is_purchasable: isPurchasable,
    quantity_available: quantityAvailable,
    stock,
  };
}
