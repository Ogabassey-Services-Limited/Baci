export interface InventoryProductLike {
  stock?: number | null;
  stock_quantity?: number | null;
  manage_stock?: boolean | null;
  low_stock_threshold?: number | null;
}

export type ProductStockBucket =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'unmanaged';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function toNonNegativeInteger(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function getEffectiveProductStock(
  product: InventoryProductLike
): number {
  const stockQuantity = toNonNegativeInteger(product.stock_quantity);
  const legacyStock = toNonNegativeInteger(product.stock);

  if (product.stock_quantity == null) {
    return legacyStock;
  }

  if (stockQuantity === 0 && legacyStock > 0) {
    return legacyStock;
  }

  return stockQuantity;
}

export function getProductLowStockThreshold(
  product: InventoryProductLike
): number {
  const threshold = product.low_stock_threshold;
  if (!Number.isFinite(threshold)) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.max(0, Math.trunc(threshold));
}

export function getProductStockBucket(
  product: InventoryProductLike
): ProductStockBucket {
  if (product.manage_stock === false) {
    return 'unmanaged';
  }

  const stock = getEffectiveProductStock(product);
  if (stock <= 0) {
    return 'out_of_stock';
  }

  if (stock <= getProductLowStockThreshold(product)) {
    return 'low_stock';
  }

  return 'in_stock';
}

export function normalizeProductInventory<T extends InventoryProductLike>(
  product: T
): T & { stock: number; stock_quantity: number } {
  const stock = getEffectiveProductStock(product);

  return {
    ...product,
    stock,
    stock_quantity: stock,
  };
}
