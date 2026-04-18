'use client';

import { useEffect, useRef } from 'react';
import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import type { Product } from '@/lib/products';
import type { ProductsResult } from '@/lib/products-server';
import { ProductsPageDialogs } from './products-page-dialogs';
import { ProductsPageShell } from './products-page-shell';
import { ProductsPageWorkflowContent } from './products-page-workflow-content';
import { useProductsPageActions } from './use-products-page-actions';

export default function ProductsPage({
  initialData,
}: {
  initialData: ProductsResult;
}) {
  return (
    <ProductProvider initialData={initialData}>
      <ProductsPageContent />
    </ProductProvider>
  );
}

function ProductsPageContent() {
  const {
    products,
    isLoading,
    migrationFilter,
    pagination,
    stats,
    workflowStep,
    setWorkflowStep,
    setMigrationFilter,
    searchTerm,
    setSearchTerm,
    setAiResponse,
    addProduct,
    statusFilter,
    stockFilter,
    setStatusFilter,
    setStockFilter,
    updateProduct,
    isAddProductOpen,
    openAddProductDialog,
    closeAddProductDialog,
    editingProduct,
  } = useProductContext();
  const { merchant, updateMerchant } = useMerchant();
  const { toast } = useToast();
  const hasAutoOpenedFromQuery = useRef(false);

  const {
    isSyncing,
    isGoogleSheetImportOpen,
    setIsGoogleSheetImportOpen,
    isCSVBulkImportOpen,
    setIsCSVBulkImportOpen,
    handleBulkPublish,
    handleSyncGoogleSheet,
    disconnectSheet,
    handleJumiaImport,
    handleGoogleSheetImport,
    handleReviewComplete,
    submitCommand,
  } = useProductsPageActions({
    connectedSheetUrl: merchant?.google_product_sheet_url,
    merchantId: merchant?.id,
    products,
    toast,
    updateMerchant,
    setWorkflowStep,
    setAiResponse,
    setSearchTerm,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || hasAutoOpenedFromQuery.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;

    hasAutoOpenedFromQuery.current = true;
    openAddProductDialog();

    params.delete('action');
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      '',
      nextQuery
        ? `${window.location.pathname}?${nextQuery}`
        : window.location.pathname
    );
  }, [openAddProductDialog]);

  const handleProductSaved = async (product: Product) => {
    if (editingProduct) {
      await updateProduct(product);
    } else {
      await addProduct(product);
    }

    closeAddProductDialog();

    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'true') {
      window.location.href = '/dashboard?setup_complete=products';
    }
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  return (
    <>
      <ProductsPageDialogs
        editingProduct={editingProduct}
        isAddProductOpen={isAddProductOpen}
        isGoogleSheetImportOpen={isGoogleSheetImportOpen}
        isCSVBulkImportOpen={isCSVBulkImportOpen}
        connectedSheetUrl={merchant?.google_product_sheet_url}
        onAddProductOpenChange={(open) => {
          if (!open) closeAddProductDialog();
        }}
        onProductSaved={handleProductSaved}
        onCancelAddProduct={closeAddProductDialog}
        onGoogleSheetImportOpenChange={setIsGoogleSheetImportOpen}
        onGoogleSheetImport={handleGoogleSheetImport}
        onCsvImportOpenChange={setIsCSVBulkImportOpen}
      />

      <ProductsPageShell
        hasConnectedGoogleSheet={Boolean(merchant?.google_product_sheet_url)}
        isLoading={isLoading}
        isSyncing={isSyncing}
        totalProducts={pagination.total}
        inventoryValueLabel={formatCurrency(stats.inventoryValue)}
        outOfStockCount={stats.outOfStockCount}
        categoryCount={stats.categoryCount}
        searchTerm={searchTerm}
        migrationFilter={migrationFilter}
        statusFilter={statusFilter}
        stockFilter={stockFilter}
        onSearchTermChange={setSearchTerm}
        onSubmitSearch={submitCommand}
        onMigrationFilterChange={setMigrationFilter}
        onStatusFilterChange={setStatusFilter}
        onStockFilterChange={setStockFilter}
        onBulkPublish={handleBulkPublish}
        onCsvImport={() => setIsCSVBulkImportOpen(true)}
        onUploadImage={() => setWorkflowStep('upload')}
        onSyncGoogleSheet={handleSyncGoogleSheet}
        onDisconnectSheet={disconnectSheet}
        onGoogleSheetImport={() => setIsGoogleSheetImportOpen(true)}
        onJumiaImport={handleJumiaImport}
        onFixImages={() => setWorkflowStep('studio')}
        onAddProduct={() => openAddProductDialog()}
      >
        <ProductsPageWorkflowContent
          workflowStep={workflowStep}
          statusFilter={statusFilter}
          stockFilter={stockFilter}
          onSetWorkflowStep={setWorkflowStep}
          onReviewComplete={handleReviewComplete}
          onEditProduct={openAddProductDialog}
        />
      </ProductsPageShell>
    </>
  );
}
