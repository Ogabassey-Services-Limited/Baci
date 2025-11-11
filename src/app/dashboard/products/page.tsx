
'use client';

import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { ProductCatalog } from '@/components/products/product-catalog';
import { FileUpload } from '@/components/products/file-upload';
import { ProcessingView } from '@/components/products/processing-view';
import { ReviewChanges } from '@/components/products/review-changes';
import { Button } from '@/components/ui/button';
import { File, PlusCircle, Search, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { processPriceList } from '@/app/dashboard/products/actions';


function ProductsPageContent() {
  const { products, workflowStep, setWorkflowStep, searchTerm, setSearchTerm, setAiResponse } = useProductContext();
  const [isLoading, setIsLoading] = useState(false);


  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Heuristic to decide if it's a command or just a search
    const isCommand = searchTerm.split(' ').length > 2 || searchTerm.includes('$') || searchTerm.toLowerCase().startsWith('update');

    if (isCommand) {
      setIsLoading(true);
      setWorkflowStep('processing');
      const response = await processPriceList(products, searchTerm, 'pasted text', 'text');
      setAiResponse(response);
      setWorkflowStep('review');
      setIsLoading(false);
      setSearchTerm(''); // Clear search term after command execution
    }
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
            <h1 className="text-2xl font-bold">Products</h1>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => setWorkflowStep('upload')}>
                    <File className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Import Price List
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
         <form onSubmit={handleCommandSubmit}>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search products or enter an AI command..."
                    className="w-full appearance-none bg-background pl-8 pr-12 shadow-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading}
                />
                 <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" disabled={isLoading}>
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
