import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductsPageShell } from './products-page-shell';

const mockActions = vi.fn((_props: unknown) => <div>Actions Slot</div>);
const mockFilters = vi.fn((_props: unknown) => <div>Filters Slot</div>);
const mockStats = vi.fn((_props: unknown) => <div>Stats Slot</div>);

vi.mock('./products-page-actions', () => ({
  ProductsPageActions: (props: unknown) => mockActions(props),
}));

vi.mock('./products-page-filters', () => ({
  ProductsPageFilters: (props: unknown) => mockFilters(props),
}));

vi.mock('./products-page-stats', () => ({
  ProductsPageStats: (props: unknown) => mockStats(props),
}));

describe('ProductsPageShell', () => {
  it('renders the shell composition and passes key props through', () => {
    render(
      <ProductsPageShell
        hasConnectedGoogleSheet
        isLoading={false}
        isSyncing
        totalProducts={12}
        inventoryValueLabel="₦12,000"
        outOfStockCount={2}
        categoryCount={4}
        searchTerm="ps5"
        migrationFilter="needs_review"
        statusFilter="active"
        stockFilter="in_stock"
        onSearchTermChange={vi.fn()}
        onSubmitSearch={vi.fn().mockResolvedValue(undefined)}
        onMigrationFilterChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onStockFilterChange={vi.fn()}
        onBulkPublish={vi.fn().mockResolvedValue(undefined)}
        onCsvImport={vi.fn()}
        onUploadImage={vi.fn()}
        onSyncGoogleSheet={vi.fn().mockResolvedValue(undefined)}
        onDisconnectSheet={vi.fn().mockResolvedValue(undefined)}
        onGoogleSheetImport={vi.fn()}
        onJumiaImport={vi.fn().mockResolvedValue(undefined)}
        onFixImages={vi.fn()}
        onAddProduct={vi.fn()}
      >
        <div>Catalog Content</div>
      </ProductsPageShell>
    );

    expect(screen.getByText('Actions Slot')).toBeInTheDocument();
    expect(screen.getByText('Stats Slot')).toBeInTheDocument();
    expect(screen.getByText('Filters Slot')).toBeInTheDocument();
    expect(screen.getByText('Catalog Content')).toBeInTheDocument();
    expect(mockActions).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: false, isSyncing: true })
    );
  });
});
