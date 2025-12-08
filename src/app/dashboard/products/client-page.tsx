'use client';

import {
  Archive,
  CheckCircle,
  ChevronDown,
  DollarSign,
  Edit,
  File,
  Infinity as InfinityIcon,
  ListFilter,
  // Loader2,
  Package,
  PlusCircle,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import AddProductForm from '@/app/dashboard/products/add/add-product-form';
import { CSVBulkImportDialog } from '@/components/products/csv-bulk-import-dialog';
import { FileUpload } from '@/components/products/file-upload';
import { GoogleSheetImportDialog } from '@/components/products/google-sheet-import-dialog';
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
    pagination,
    stats,
    workflowStep,
    setWorkflowStep,
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
  const { merchant } = useMerchant();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleSheetImportOpen, setIsGoogleSheetImportOpen] = useState(false);
  const [isCSVBulkImportOpen, setIsCSVBulkImportOpen] = useState(false);
  const { toast } = useToast();

  // Auto-open add product dialog if action=new
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'new') {
        // We need to wait for context to be ready or just call it
        // Since useProductContext is available, we can call it immediately
        // but we might need to wrap in useEffect if strict mode complains
        setTimeout(() => openAddProductDialog(), 100);
      }
    }
  });

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
    setIsProcessing(true);
    setWorkflowStep('processing');
    try {
      // Create AI job instead of calling processPriceList directly
      const response = await fetch('/api/ai-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'price_list_processing',
          input: {
            currentProducts: products,
            priceListData: data,
            vendor: vendor,
            fileType: fileType,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create AI job');
      }

      const { job } = await response.json();

      let pollInterval: NodeJS.Timeout | null = null;

      // Poll for job completion
      pollInterval = setInterval(async () => {
        const jobResponse = await fetch(`/api/ai-jobs/${job.id}`);
        const { job: updatedJob } = await jobResponse.json();

        if (updatedJob.status === 'completed') {
          if (pollInterval) clearInterval(pollInterval);
          setAiResponse(updatedJob.output);
          setWorkflowStep('review');
          setIsProcessing(false);
          setSearchTerm('');
        } else if (updatedJob.status === 'failed') {
          if (pollInterval) clearInterval(pollInterval);
          console.error('AI processing failed:', updatedJob.error);
          toast({
            title: 'AI Processing Failed',
            description: updatedJob.error || 'An error occurred',
            variant: 'destructive',
          });
          setWorkflowStep('view');
          setIsProcessing(false);
        }
      }, 2000); // Poll every 2 seconds

      // Timeout after 60 seconds
      setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        if (isProcessing) {
          toast({
            title: 'Processing Timeout',
            description:
              'The AI is taking longer than expected. Please check back later.',
            variant: 'destructive',
          });
          setWorkflowStep('view');
          setIsProcessing(false);
        }
      }, 60000);
    } catch (error) {
      console.error('AI processing failed', error);
      toast({
        title: 'Error',
        description: 'Failed to start AI processing',
        variant: 'destructive',
      });
      setWorkflowStep('view');
      setIsProcessing(false);
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
    } catch (error) {
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

  const renderContent = () => {
    switch (workflowStep) {
      case 'upload':
        return <FileUpload />;
      case 'processing':
        return <ProcessingView />;
      case 'review':
        return <ReviewChanges />;
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
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
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
        onImport={(data) =>
          startAiProcessing(data, 'Google Sheet Import', 'csv')
        }
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
                  Bulk CSV Import
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={() => setWorkflowStep('upload')}
              >
                <File className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Import Price List
                </span>
              </Button>
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
