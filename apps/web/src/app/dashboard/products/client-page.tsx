'use client';

import {
  Archive,
  CheckCircle,
  ChevronDown,
  DollarSign,
  Edit,
  File,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  ListFilter,
  // Loader2,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AIResponse } from '@/app/dashboard/products/actions';
import AddProductForm from '@/app/dashboard/products/add/add-product-form';
import { CSVBulkImportDialog } from '@/components/products/csv-bulk-import-dialog';
import { FileUpload } from '@/components/products/file-upload';
import { GoogleSheetImportDialog } from '@/components/products/google-sheet-import-dialog';
import { MissingImagesView } from '@/components/products/missing-images-view';
import { ProcessingView } from '@/components/products/processing-view';
import { ProductCatalog } from '@/components/products/product-catalog';
import { ReviewChanges } from '@/components/products/review-changes';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';

const GoogleSheetIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5 text-green-600"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

import type { Product } from '@/lib/products';

import type { ProductsResult } from '@/lib/products-server';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSheetUrl, setPendingSheetUrl] = useState<string | null>(null);

  const handleSyncGoogleSheet = async () => {
    if (!merchant?.google_product_sheet_url) return;

    setIsSyncing(true);
    try {
      const { fetchGoogleSheet } = await import(
        '@/app/dashboard/products/actions'
      );
      const csvContent = await fetchGoogleSheet(
        merchant.google_product_sheet_url
      );

      await startAiProcessing(csvContent, 'Google Sheet Sync', 'csv');
      toast({
        title: 'Sync Started',
        description: 'Analyzing changes from your connected sheet...',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Sync Failed',
        description: 'Could not fetch the connected sheet.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isGoogleSheetImportOpen, setIsGoogleSheetImportOpen] = useState(false);
  const [isCSVBulkImportOpen, setIsCSVBulkImportOpen] = useState(false);
  const { toast } = useToast();
  const hasAutoOpenedFromQuery = useRef(false);

  // Auto-open add product dialog if action=new
  useEffect(() => {
    if (typeof window === 'undefined' || hasAutoOpenedFromQuery.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;

    hasAutoOpenedFromQuery.current = true;
    openAddProductDialog();

    // Consume trigger to avoid reopening on subsequent renders.
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
      addProduct(product);
    }
    closeAddProductDialog();

    // Check for onboarding redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'true') {
      window.location.href = '/dashboard?setup_complete=products';
    }
  };

  const startAiProcessing = async (
    data: string,
    vendor: string,
    fileType: string
  ) => {
    setWorkflowStep('processing');
    try {
      const { parseCSVDirectly, processPriceList } = await import(
        '@/app/dashboard/products/actions'
      );

      // Log input data for debugging
      const lines = data.split('\n').filter((l) => l.trim());
      console.log(`[CSV Import] Total lines in file: ${lines.length}`);
      console.log(`[CSV Import] First 3 lines:`, lines.slice(0, 3));
      console.log(`[CSV Import] Existing products in DB: ${products.length}`);

      // Step 1: Always try direct CSV parsing first (fast, no limits)
      console.log('[CSV Import] Starting direct CSV parsing...');
      const startTime = performance.now();
      const directResult = await parseCSVDirectly(products, data);
      const parseTime = performance.now() - startTime;
      console.log(
        `[CSV Import] Direct parsing completed in ${parseTime.toFixed(0)}ms`
      );
      console.log(
        `[CSV Import] Result: ${directResult.changes?.length || 0} changes, Summary: ${directResult.summary}`
      );

      // Step 2: Only fallback to AI if there's a structural parsing error AND file is small
      const hasStructuralError =
        !directResult ||
        directResult.summary?.includes('Could not find') || // Header parsing failed
        directResult.summary?.includes('No data rows'); // Empty file

      let response: AIResponse;

      if (hasStructuralError) {
        // If file is large (> 50 lines), do NOT fallback to AI as it will hit token limits.
        // Instead, show the specific parsing error so user can fix headers.
        if (lines.length > 50) {
          console.log(
            '[CSV Import] Large file failed parsing. Aborting to show error.'
          );
          throw new Error(directResult.summary);
        }

        // Only fallback to AI for structural/format issues on SMALL files
        console.log(
          '[CSV Import] Structural parsing error on small file. Falling back to AI...'
        );
        response = await processPriceList(products, data, vendor, fileType);
      } else {
        // Direct parsing worked - use it even if 0 changes (means no updates needed)
        console.log(
          `[CSV Import] ✅ Direct parsing succeeded: ${directResult.changes.length} products found.`
        );
        response = directResult;
      }

      setAiResponse(response);
      setWorkflowStep('review');
      setSearchTerm('');
    } catch (error) {
      console.error('[CSV Import] Processing failed:', error);
      toast({
        title: 'Processing Failed',
        description:
          error instanceof Error ? error.message : 'Failed to analyze products',
        variant: 'destructive',
      });
      setWorkflowStep('view');
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    // Heuristic to check for multi-line pastes or commands.
    const isCommand = query.includes('\n');

    if (isCommand) {
      await startAiProcessing(query, 'pasted text', 'text');
    }
  };

  const handleGoogleSheetImport = () => {
    setIsGoogleSheetImportOpen(true);
  };

  const handleCSVBulkImport = () => {
    setIsCSVBulkImportOpen(true);
  };

  const handleBulkPublish = async () => {
    try {
      const response = await fetch('/api/products/bulk-publish', {
        method: 'POST',
      });
      const result = await response.json();
      if (response.ok) {
        toast({
          title: 'Products Updated',
          description: `Deleted ${result.deletedDrafts} drafts, published ${result.publishedProducts} products.`,
        });
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to bulk publish products',
        variant: 'destructive',
      });
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

  const statusFilterOptions = [
    { value: 'All', label: 'All Statuses', icon: ListFilter },
    { value: 'published', label: 'Published', icon: CheckCircle },
    { value: 'draft', label: 'Draft', icon: Edit },
    { value: 'archived', label: 'Archived', icon: Trash2 },
  ];

  const stockFilterOptions = [
    { value: 'All', label: 'All Stock Levels' },
    { value: 'in_stock', label: 'In Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'infinite', label: 'Infinite' },
  ];

  const migrationFilterOptions = [
    { value: 'All', label: 'All Migration States', icon: ListFilter },
    { value: 'needs_review', label: 'Needs Review', icon: RefreshCw },
    { value: 'migrated', label: 'Migrated', icon: CheckCircle },
    { value: 'pending', label: 'Pending', icon: Archive },
  ];

  const renderContent = () => {
    switch (workflowStep) {
      case 'upload':
        return <FileUpload />;
      case 'processing':
        return <ProcessingView />;
      case 'studio':
        return (
          <>
            <div className="flex items-center gap-2 mb-6">
              <Button variant="ghost" onClick={() => setWorkflowStep('view')}>
                ← Back to List
              </Button>
            </div>
            <MissingImagesView />
          </>
        );
      case 'review':
        return (
          <ReviewChanges
            onComplete={async () => {
              if (pendingSheetUrl) {
                try {
                  await updateMerchant(
                    { google_product_sheet_url: pendingSheetUrl },
                    { skipReload: true }
                  );
                  setPendingSheetUrl(null);
                } catch (error) {
                  console.error(
                    'Failed to save sheet URL after import:',
                    error
                  );
                }
              }
            }}
          />
        );
      default:
        return (
          <ProductCatalog
            statusFilter={statusFilter}
            stockFilter={stockFilter}
            onEditProduct={openAddProductDialog}
          />
        );
    }
  };

  return (
    <>
      <Dialog
        open={isAddProductOpen}
        onOpenChange={(open) => {
          if (!open) closeAddProductDialog();
        }}
      >
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct?.migration_status === 'needs_review'
                ? 'Resolve SKU Matrix Review'
                : editingProduct
                  ? 'Edit Product'
                  : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct?.migration_status === 'needs_review'
                ? 'This product was flagged during SKU matrix rollout. Review the matrix data, fix any ambiguity, and save to clear the review flag.'
                : editingProduct
                  ? 'Update product details below.'
                  : 'Fill in the details below to add a new product to your catalog.'}
            </DialogDescription>
          </DialogHeader>
          <AddProductForm
            onProductAdded={handleProductSaved}
            onCancel={closeAddProductDialog}
            initialData={editingProduct}
          />
        </DialogContent>
      </Dialog>

      <GoogleSheetImportDialog
        open={isGoogleSheetImportOpen}
        onOpenChange={setIsGoogleSheetImportOpen}
        initialUrl={merchant?.google_product_sheet_url}
        onImport={(data, url, saveUrl) => {
          startAiProcessing(data, 'Google Sheet Import', 'csv');
          if (saveUrl && url !== merchant?.google_product_sheet_url) {
            // Defer saving URL until import is successful
            setPendingSheetUrl(url);
          }
        }}
      />

      <CSVBulkImportDialog
        open={isCSVBulkImportOpen}
        onOpenChange={setIsCSVBulkImportOpen}
        onImportComplete={() => window.location.reload()}
      />

      <div className="flex flex-col h-full">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
              Products 🛍️
            </h1>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1 text-green-600 border-green-300 hover:bg-green-50"
                onClick={handleBulkPublish}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Publish All
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={handleCSVBulkImport}
              >
                <Send className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Upload CSV
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={() => setWorkflowStep('upload')}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Upload Image
                </span>
              </Button>
              {merchant?.google_product_sheet_url ? (
                <div className="flex items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-r-none border-r-0"
                    onClick={handleSyncGoogleSheet}
                    disabled={isSyncing || isLoading}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                    />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Sync Sheet
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-2 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-l-none border-l-0"
                        disabled={isSyncing || isLoading}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span className="sr-only">Options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await updateMerchant({
                              google_product_sheet_url: undefined,
                            });
                            toast({
                              title: 'Sheet Disconnected',
                              description:
                                'You can now connect a different sheet.',
                            });
                          } catch {
                            toast({
                              title: 'Error',
                              description: 'Failed to disconnect sheet.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Disconnect Sheet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1"
                  onClick={handleGoogleSheetImport}
                >
                  <GoogleSheetIcon />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Import from Google Sheet
                  </span>
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={async () => {
                  if (!merchant?.id) return;
                  const _toastId = toast({
                    title: 'Importing from Jumia...',
                    description: 'Fetching products...',
                  });
                  try {
                    const res = await fetch(
                      '/api/marketplace/jumia/products/import',
                      {
                        method: 'POST',
                        body: JSON.stringify({ merchantId: merchant.id }),
                      }
                    );
                    const data = await res.json();
                    if (res.ok) {
                      toast({
                        title: 'Import Successful',
                        description: `Created: ${data.summary.created}, Linked: ${data.summary.linked}`,
                      });
                      window.location.reload();
                    } else {
                      throw new Error(data.error);
                    }
                  } catch (e) {
                    toast({
                      title: 'Import Failed',
                      description:
                        e instanceof Error ? e.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Jumia Import
                </span>
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary"
                onClick={() => setWorkflowStep('studio')}
              >
                <ImageIcon className="h-4 w-4" />
                Fix Images
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1"
                onClick={() => openAddProductDialog()}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Add Product
                </span>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 transition-transform transform hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Total Products
                </CardTitle>
                <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {pagination.total}
                </div>
                <p className="text-xs text-muted-foreground dark:text-blue-300/70">
                  items in your catalog
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 transition-transform transform hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">
                  Inventory Value
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(stats.inventoryValue)}
                </div>
                <p className="text-xs text-muted-foreground dark:text-green-300/70">
                  Total value of tracked stock
                </p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 transition-transform transform hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">
                  Out of Stock
                </CardTitle>
                <Archive className="h-4 w-4 text-red-600 dark:text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {stats.outOfStockCount}
                </div>
                <p className="text-xs text-muted-foreground dark:text-red-300/70">
                  items need restocking
                </p>
              </CardContent>
            </Card>
            <Link href="/dashboard/categories" className="contents">
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800 transition-transform transform hover:scale-105 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Categories
                  </CardTitle>
                  <File className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {stats.categoryCount}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-yellow-300/70">
                    product categories
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <form onSubmit={handleCommandSubmit}>
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Search products or paste a price list to run AI updates... ✨"
                  className="w-full resize-none appearance-none bg-background pl-8 pr-12 shadow-none min-h-[40px] pt-2.5 border-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                  rows={1}
                  id="product-search"
                  name="search"
                  aria-label="Search products or paste price list"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-2 top-1.5 h-8 w-8"
                  disabled={isLoading || !searchTerm.trim()}
                >
                  {isLoading ? (
                    <BagLoader size={16} />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="sr-only">Submit</span>
                </Button>
              </div>
            </form>

            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
                  >
                    <ListFilter className="h-4 w-4" />
                    <span>Migration: {migrationFilter.replace('_', ' ')}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {migrationFilterOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={migrationFilter === option.value}
                      onCheckedChange={() => setMigrationFilter(option.value)}
                      className="text-blue-800 dark:text-blue-100 capitalize"
                    >
                      <option.icon className="mr-2 h-4 w-4" />
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
                  >
                    <ListFilter className="h-4 w-4" />
                    <span>Status: {statusFilter}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {statusFilterOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={statusFilter === option.value}
                      onCheckedChange={() => setStatusFilter(option.value)}
                      className="text-blue-800 dark:text-blue-100 capitalize"
                    >
                      <option.icon className="mr-2 h-4 w-4" />
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
                  >
                    <ListFilter className="h-4 w-4" />
                    <span>Stock: {stockFilter.replace('_', ' ')}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {stockFilterOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={stockFilter === option.value}
                      onCheckedChange={() => setStockFilter(option.value)}
                      className="text-blue-800 dark:text-blue-100 capitalize"
                    >
                      {option.label === 'Infinite' ? (
                        <InfinityIcon className="mr-2 h-4 w-4" />
                      ) : (
                        <Package className="mr-2 h-4 w-4" />
                      )}
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col">{renderContent()}</div>
      </div>
    </>
  );
}
