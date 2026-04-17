import {
  Archive,
  CheckCircle,
  Edit,
  Infinity as InfinityIcon,
  ListFilter,
  type LucideIcon,
  Package,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  MigrationFilterValue,
  StatusFilterValue,
  StockFilterValue,
} from '@/lib/product-list-filters';

export interface ProductsFilterOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export const statusFilterOptions: ProductsFilterOption<StatusFilterValue>[] = [
  { value: 'All', label: 'All Statuses', icon: ListFilter },
  { value: 'active', label: 'Active', icon: CheckCircle },
  { value: 'draft', label: 'Draft', icon: Edit },
  { value: 'archived', label: 'Archived', icon: Trash2 },
];

export const stockFilterOptions: ProductsFilterOption<StockFilterValue>[] = [
  { value: 'All', label: 'All Stock Levels', icon: Package },
  { value: 'in_stock', label: 'In Stock', icon: Package },
  { value: 'out_of_stock', label: 'Out of Stock', icon: Package },
  { value: 'infinite', label: 'Infinite', icon: InfinityIcon },
];

export const migrationFilterOptions: ProductsFilterOption<MigrationFilterValue>[] =
  [
    { value: 'All', label: 'All Migration States', icon: ListFilter },
    { value: 'needs_review', label: 'Needs Review', icon: RefreshCw },
    { value: 'migrated', label: 'Migrated', icon: CheckCircle },
    { value: 'pending', label: 'Pending', icon: Archive },
  ];
