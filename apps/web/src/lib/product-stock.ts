export interface StockLike {
  stock?: number | string | null;
  stock_quantity?: number | string | null;
}

export interface ManagedStockLike extends StockLike {
  manage_stock?: boolean | null;
}

export type ProductStockFilter = 'All' | 'in_stock' | 'out_of_stock';

function toFiniteNumber(
  value: number | string | null | undefined
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getEffectiveStock(item: StockLike): number {
  const stockQuantity = toFiniteNumber(item.stock_quantity);
  const legacyStock = toFiniteNumber(item.stock);

  if (stockQuantity == null) {
    return Math.max(0, legacyStock ?? 0);
  }

  if (stockQuantity === 0 && (legacyStock ?? 0) > 0) {
    return Math.max(0, legacyStock ?? 0);
  }

  return Math.max(0, stockQuantity);
}

export function matchesProductStockFilter(
  item: ManagedStockLike,
  filter: ProductStockFilter | string
): boolean {
  if (filter === 'All') {
    return true;
  }

  const managesStock = item.manage_stock ?? true;
  const stock = getEffectiveStock(item);

  if (filter === 'out_of_stock') {
    return managesStock && stock <= 0;
  }

  if (filter === 'in_stock') {
    return !managesStock || stock > 0;
  }

  return true;
}
