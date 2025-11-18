
'use client';

import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { ProductCatalog } from '@/components/products/product-catalog';
import { FileUpload } from '@/components/products/file-upload';
import { ProcessingView } from '@/components/products/processing-view';
import { ReviewChanges } from '@/components/products/review-changes';
import { Button } from '@/components/ui/button';
import { File, PlusCircle, Search, Loader2, Send, Archive, DollarSign, Package } from 'lucide-react';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { useState, useMemo } from 'react';
import { processPriceList } from '@/app/dashboard/products/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';

const GoogleSheetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
);


function ProductsPageContent() {
  const { products, workflowStep, setWorkflowStep, searchTerm, setSearchTerm, setAiResponse } = useProductContext();
  const { merchant } = useMerchant();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    // Heuristic to check for multi-line pastes or commands.
    const isCommand = query.includes('\n');
    
    if (isCommand) {
        setIsLoading(true);
        setWorkflowStep('processing');
        try {
            const response = await processPriceList(products, query, 'pasted text', 'text');
            setAiResponse(response);
            setWorkflowStep('review');
        } catch (error) {
            console.error("AI processing failed", error);
            setWorkflowStep('view'); // Revert to view on error
        } finally {
            setIsLoading(false);
            setSearchTerm(''); // Clear search term after command execution
        }
    }
  };
  
  const handleGoogleSheetImport = () => {
    toast({
        title: 'Coming Soon! 🚀',
        description: 'Google Sheets integration is under development.'
    });
  };

  const inventoryValue = useMemo(() => {
    return products.reduce((total, product) => total + (product.price * product.stock), 0);
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };


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
        return <ProductCatalog />;
    }
  };

  return (
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
                <Link href="/dashboard/products/add">
                    <Button size="sm" className="h-9 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Product
                        </span>
                    </Button>
                </Link>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{products.length}</div>
                <p className="text-xs text-muted-foreground">items in your catalog</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(inventoryValue)}</div>
                <p className="text-xs text-muted-foreground">Total value of stock</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{outOfStockCount}</div>
                <p className="text-xs text-muted-foreground">items need restocking</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <File className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">product categories</p>
                </CardContent>
            </Card>
        </div>


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
      </div>
      <div className="flex-1 flex flex-col">{renderContent()}</div>
    </div>
  );
}

export default function ProductsPage() {
    return (
        <ProductProvider>
            <ProductsPageContent />
        </ProductProvider>
    )
}
