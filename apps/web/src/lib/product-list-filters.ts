export const migrationFilterValues = [
  'All',
  'needs_review',
  'migrated',
  'pending',
] as const;

export const statusFilterValues = [
  'All',
  'active',
  'draft',
  'archived',
] as const;

export const stockFilterValues = [
  'All',
  'in_stock',
  'out_of_stock',
  'infinite',
] as const;

export type MigrationFilterValue = (typeof migrationFilterValues)[number];
export type StatusFilterValue = (typeof statusFilterValues)[number];
export type StockFilterValue = (typeof stockFilterValues)[number];

export interface ProductListFilters {
  migration: MigrationFilterValue;
  status: StatusFilterValue;
  stock: StockFilterValue;
  search: string;
}

export const DEFAULT_PRODUCT_LIST_FILTERS: ProductListFilters = {
  migration: 'All',
  status: 'All',
  stock: 'All',
  search: '',
};

export function getMigrationFilterLabel(value: MigrationFilterValue): string {
  switch (value) {
    case 'needs_review':
      return 'Needs Review';
    case 'migrated':
      return 'Migrated';
    case 'pending':
      return 'Pending';
    default:
      return 'All Migration States';
  }
}

export function getStatusFilterLabel(value: StatusFilterValue): string {
  switch (value) {
    case 'active':
      return 'Active';
    case 'draft':
      return 'Draft';
    case 'archived':
      return 'Archived';
    default:
      return 'All Statuses';
  }
}

export function getStockFilterLabel(value: StockFilterValue): string {
  switch (value) {
    case 'in_stock':
      return 'In Stock';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'infinite':
      return 'Infinite';
    default:
      return 'All Stock Levels';
  }
}
