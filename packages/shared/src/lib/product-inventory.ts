export interface ProductInventoryLike {
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  manage_stock?: boolean | null;
  low_stock_threshold?: number | string | null;
}

export type ProductStockBucket =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'unmanaged';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function toFiniteInteger(
  value: number | string | null | undefined
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

export function toNonNegativeInteger(
  value: number | string | null | undefined
): number {
  return Math.max(0, toFiniteInteger(value) ?? 0);
}

export function getEffectiveProductStock(
  product: Pick<ProductInventoryLike, 'stock' | 'stock_quantity'>
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
  product: Pick<ProductInventoryLike, 'low_stock_threshold'>
): number {
  const threshold = toFiniteInteger(product.low_stock_threshold);
  if (threshold == null) {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
  return Math.max(0, threshold);
}

export function getProductStockBucket(
  product: ProductInventoryLike
): ProductStockBucket {
  if (product.manage_stock !== true) {
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

export function normalizeProductInventory<T extends ProductInventoryLike>(
  product: T
): T & { stock: number; stock_quantity: number } {
  const stock = getEffectiveProductStock(product);

  return {
    ...product,
    stock,
    stock_quantity: stock,
  };
}
