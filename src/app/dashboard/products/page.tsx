
'use client';

import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { ProductCatalog } from '@/components/products/product-catalog';
import { FileUpload } from '@/components/products/file-upload';
import { ProcessingView } from '@/components/products/processing-view';
import { ReviewChanges } from '@/components/products/review-changes';
import { Button } from '@/components/ui/button';
import { File, PlusCircle, Search, Loader2, Send, Archive, Package, DollarSign, ListFilter, ChevronDown, CheckCircle, Edit, Trash2, Infinity } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AddProductForm from '@/app/dashboard/products/add/add-product-form';

const GoogleSheetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
);


import type { Product } from '@/lib/products';

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
        updateProduct
    } = useProductContext();
    const { merchant } = useMerchant();
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setIsAddProductOpen(true);
    };

    const handleProductSaved = async (product: Product) => {
        if (editingProduct) {
            await updateProduct(product);
        } else {
            addProduct(product);
        }
        setIsAddProductOpen(false);
        setEditingProduct(null);
    };

    // ... existing code ...

    // I need to find where the Dialog is and update it.
    // Since I can't see the whole file, I'll assume I need to replace the Dialog block separately.
    // But wait, I can't replace multiple non-contiguous blocks with replace_file_content unless I use multi_replace.
    // Let's use multi_replace for this.


    const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const query = searchTerm.trim();
        if (!query) return;

        // Heuristic to check for multi-line pastes or commands.
        const isCommand = query.includes('\n');

        if (isCommand) {
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
                            priceListData: query,
                            vendor: 'pasted text',
                            fileType: 'text'
                        }
                    })
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
                        console.error("AI processing failed:", updatedJob.error);
                        toast({
                            title: 'AI Processing Failed',
                            description: updatedJob.error || 'An error occurred',
                            variant: 'destructive'
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
                            description: 'The AI is taking longer than expected. Please check back later.',
                            variant: 'destructive'
                        });
                        setWorkflowStep('view');
                        setIsProcessing(false);
                    }
                }, 60000);

            } catch (error) {
                console.error("AI processing failed", error);
                toast({
                    title: 'Error',
                    description: 'Failed to start AI processing',
                    variant: 'destructive'
                });
                setWorkflowStep('view');
                setIsProcessing(false);
            }
        }
    };

    const handleGoogleSheetImport = () => {
        toast({
            title: 'Coming Soon! 🚀',
            description: 'Google Sheets integration is under development.'
        });
    };

    const formatCurrency = (amount: number) => {
        const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
        const locale = country ? `en-${country.code}` : 'en-US';
        const currency = country ? country.currency : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(amount);
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
            case 'view':
            default:
                return <ProductCatalog statusFilter={statusFilter} stockFilter={stockFilter} />;
        }
    };

    return (
        <>
            <Dialog open={isAddProductOpen} onOpenChange={(open) => {
                setIsAddProductOpen(open);
                if (!open) setEditingProduct(null);
            }}>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                        <DialogDescription>
                            {editingProduct ? 'Update product details below.' : 'Fill in the details below to add a new product to your catalog.'}
                        </DialogDescription>
                    </DialogHeader>
                    <AddProductForm
                        onProductAdded={handleProductSaved}
                        onCancel={() => {
                            setIsAddProductOpen(false);
                            setEditingProduct(null);
                        }}
                        initialData={editingProduct}
                    />
                </DialogContent>
            </Dialog>

            <div className="flex flex-col h-full">
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Products 🛍️</h1>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => setWorkflowStep('upload')}>
                                <File className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                    Import Price List
                                </span>
                            </Button>
                            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={handleGoogleSheetImport}>
                                <GoogleSheetIcon />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                    Import from Google Sheet
                                </span>
                            </Button>
                            <Button size="sm" className="h-9 gap-1" onClick={() => setIsAddProductOpen(true)}>
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                    Add Product
                                </span>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-blue-50 border-blue-200 transition-transform transform hover:scale-105">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-blue-800">Total Products</CardTitle>
                                <Package className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-900">{pagination.total}</div>
                                <p className="text-xs text-muted-foreground">items in your catalog</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-200 transition-transform transform hover:scale-105">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-green-800">Inventory Value</CardTitle>
                                <DollarSign className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.inventoryValue)}</div>
                                <p className="text-xs text-muted-foreground">Total value of tracked stock</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-50 border-red-200 transition-transform transform hover:scale-105">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-red-800">Out of Stock</CardTitle>
                                <Archive className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-900">{stats.outOfStockCount}</div>
                                <p className="text-xs text-muted-foreground">items need restocking</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-yellow-50 border-yellow-200 transition-transform transform hover:scale-105">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-yellow-800">Categories</CardTitle>
                                <File className="h-4 w-4 text-yellow-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-900">5</div>
                                <p className="text-xs text-muted-foreground">product categories</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-2">
                        <form onSubmit={handleCommandSubmit}>
                            <div className="relative w-full">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Textarea
                                    placeholder="Search products or paste a price list to run AI updates... ✨"
                                    className="w-full resize-none appearance-none bg-background pl-8 pr-12 shadow-none min-h-[40px] pt-2.5"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    disabled={isLoading}
                                    rows={1}
                                />
                                <Button type="submit" size="icon" className="absolute right-2 top-1.5 h-8 w-8" disabled={isLoading || !searchTerm.trim()}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    <span className="sr-only">Submit</span>
                                </Button>
                            </div>
                        </form>

                        <div className="flex gap-2 items-center text-sm text-muted-foreground">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900">
                                        <ListFilter className="h-4 w-4" />
                                        <span>Status: {statusFilter}</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {statusFilterOptions.map(option => (
                                        <DropdownMenuCheckboxItem key={option.value} checked={statusFilter === option.value} onCheckedChange={() => setStatusFilter(option.value)} className="text-blue-800 capitalize">
                                            <option.icon className="mr-2 h-4 w-4" />
                                            {option.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900">
                                        <ListFilter className="h-4 w-4" />
                                        <span>Stock: {stockFilter.replace('_', ' ')}</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {stockFilterOptions.map(option => (
                                        <DropdownMenuCheckboxItem key={option.value} checked={stockFilter === option.value} onCheckedChange={() => setStockFilter(option.value)} className="text-blue-800 capitalize">
                                            {option.label === 'Infinite' ? <Infinity className="mr-2 h-4 w-4" /> : <Package className="mr-2 h-4 w-4" />}
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

export default function ProductsPage() {
    return (
        <ProductProvider>
            <ProductsPageContent />
        </ProductProvider>
    )
}
