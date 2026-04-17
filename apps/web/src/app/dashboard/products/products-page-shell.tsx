'use client';

import type { ReactNode } from 'react';
import type {
  MigrationFilterValue,
  StatusFilterValue,
  StockFilterValue,
} from '@/lib/product-list-filters';
import { ProductsPageActions } from './products-page-actions';
import { ProductsPageFilters } from './products-page-filters';
import { ProductsPageStats } from './products-page-stats';

interface ProductsPageShellProps {
  hasConnectedGoogleSheet: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  totalProducts: number;
  inventoryValueLabel: string;
  outOfStockCount: number;
  categoryCount: number;
  searchTerm: string;
  migrationFilter: MigrationFilterValue;
  statusFilter: StatusFilterValue;
  stockFilter: StockFilterValue;
  onSearchTermChange: (value: string) => void;
  onSubmitSearch: (query: string) => Promise<void>;
  onMigrationFilterChange: (value: MigrationFilterValue) => void;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  onStockFilterChange: (value: StockFilterValue) => void;
  onBulkPublish: () => Promise<void>;
  onCsvImport: () => void;
  onUploadImage: () => void;
  onSyncGoogleSheet: () => Promise<void>;
  onDisconnectSheet: () => Promise<void>;
  onGoogleSheetImport: () => void;
  onJumiaImport: () => Promise<void>;
  onFixImages: () => void;
  onAddProduct: () => void;
  children: ReactNode;
}

export function ProductsPageShell({
  hasConnectedGoogleSheet,
  isLoading,
  isSyncing,
  totalProducts,
  inventoryValueLabel,
  outOfStockCount,
  categoryCount,
  searchTerm,
  migrationFilter,
  statusFilter,
  stockFilter,
  onSearchTermChange,
  onSubmitSearch,
  onMigrationFilterChange,
  onStatusFilterChange,
  onStockFilterChange,
  onBulkPublish,
  onCsvImport,
  onUploadImage,
  onSyncGoogleSheet,
  onDisconnectSheet,
  onGoogleSheetImport,
  onJumiaImport,
  onFixImages,
  onAddProduct,
  children,
}: ProductsPageShellProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Products 🛍️
          </h1>
          <ProductsPageActions
            hasConnectedGoogleSheet={hasConnectedGoogleSheet}
            isLoading={isLoading}
            isSyncing={isSyncing}
            onBulkPublish={onBulkPublish}
            onCsvImport={onCsvImport}
            onUploadImage={onUploadImage}
            onSyncGoogleSheet={onSyncGoogleSheet}
            onDisconnectSheet={onDisconnectSheet}
            onGoogleSheetImport={onGoogleSheetImport}
            onJumiaImport={onJumiaImport}
            onFixImages={onFixImages}
            onAddProduct={onAddProduct}
          />
        </div>

        <ProductsPageStats
          totalProducts={totalProducts}
          inventoryValueLabel={inventoryValueLabel}
          outOfStockCount={outOfStockCount}
          categoryCount={categoryCount}
        />

        <ProductsPageFilters
          isLoading={isLoading}
          searchTerm={searchTerm}
          migrationFilter={migrationFilter}
          statusFilter={statusFilter}
          stockFilter={stockFilter}
          onSearchTermChange={onSearchTermChange}
          onSubmitSearch={onSubmitSearch}
          onMigrationFilterChange={onMigrationFilterChange}
          onStatusFilterChange={onStatusFilterChange}
          onStockFilterChange={onStockFilterChange}
        />
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
