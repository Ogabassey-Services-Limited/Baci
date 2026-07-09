import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductsResult } from '@/lib/products-server';
import ProductsPage from './client-page';

const mocks = vi.hoisted(() => ({
  closeAddProductDialog: vi.fn(),
  openAddProductDialog: vi.fn(),
  setAiResponse: vi.fn(),
  setMigrationFilter: vi.fn(),
  setSearchTerm: vi.fn(),
  setStatusFilter: vi.fn(),
  setStockFilter: vi.fn(),
  setWorkflowStep: vi.fn(),
  updateMerchant: vi.fn(),
  useMerchant: vi.fn(),
  useProductContext: vi.fn(),
}));

vi.mock('@/contexts/product-context', () => ({
  ProductProvider: ({ children }: { children: React.ReactNode }) => children,
  useProductContext: mocks.useProductContext,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./products-page-dialogs', () => ({
  ProductsPageDialogs: () => null,
}));

vi.mock('./products-page-shell', () => ({
  ProductsPageShell: ({
    inventoryValueLabel,
  }: {
    inventoryValueLabel: string;
  }) => <output aria-label="inventory value">{inventoryValueLabel}</output>,
}));

vi.mock('./products-page-workflow-content', () => ({
  ProductsPageWorkflowContent: () => null,
}));

vi.mock('./use-products-page-actions', () => ({
  useProductsPageActions: () => ({
    disconnectSheet: vi.fn(),
    handleBulkPublish: vi.fn(),
    handleGoogleSheetImport: vi.fn(),
    handleJumiaImport: vi.fn(),
    handleReviewComplete: vi.fn(),
    handleSyncGoogleSheet: vi.fn(),
    isCSVBulkImportOpen: false,
    isGoogleSheetImportOpen: false,
    isSyncing: false,
    setIsCSVBulkImportOpen: vi.fn(),
    setIsGoogleSheetImportOpen: vi.fn(),
    submitCommand: vi.fn(),
  }),
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        country: null,
        google_product_sheet_url: null,
        id: 'merchant-1',
        payout_currency: 'NGN',
      },
      updateMerchant: mocks.updateMerchant,
    });
    mocks.useProductContext.mockReturnValue({
      addProduct: vi.fn(),
      closeAddProductDialog: mocks.closeAddProductDialog,
      editingProduct: null,
      isAddProductOpen: false,
      isLoading: false,
      migrationFilter: 'all',
      openAddProductDialog: mocks.openAddProductDialog,
      pagination: { limit: 20, page: 1, total: 1, totalPages: 1 },
      products: [],
      searchTerm: '',
      setAiResponse: mocks.setAiResponse,
      setMigrationFilter: mocks.setMigrationFilter,
      setSearchTerm: mocks.setSearchTerm,
      setStatusFilter: mocks.setStatusFilter,
      setStockFilter: mocks.setStockFilter,
      setWorkflowStep: mocks.setWorkflowStep,
      stats: {
        categoryCount: 1,
        inventoryValue: 1000,
        outOfStockCount: 0,
      },
      statusFilter: 'all',
      stockFilter: 'all',
      updateProduct: vi.fn(),
      workflowStep: 'view',
    });
  });

  it('formats dashboard inventory value from payout currency when country is missing', () => {
    render(<ProductsPage initialData={{} as ProductsResult} />);

    expect(screen.getByLabelText(/inventory value/i)).toHaveTextContent(
      '₦1,000.00'
    );
  });

  it('falls back to NGN when country and payout currency are missing', () => {
    // Platform fallback is NGN (canonical resolver), not USD: every merchant
    // row carries a NOT NULL payout_currency defaulting to NGN, so a missing
    // value can only mean an incompletely-loaded record on the home market.
    mocks.useMerchant.mockReturnValue({
      merchant: {
        country: null,
        google_product_sheet_url: null,
        id: 'merchant-1',
        payout_currency: null,
      },
      updateMerchant: mocks.updateMerchant,
    });

    render(<ProductsPage initialData={{} as ProductsResult} />);

    expect(screen.getByLabelText(/inventory value/i)).toHaveTextContent(
      '₦1,000.00'
    );
  });
});
