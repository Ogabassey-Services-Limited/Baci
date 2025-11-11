
'use client';

import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { ProductCatalog } from '@/components/products/product-catalog';
import { FileUpload } from '@/components/products/file-upload';
import { ProcessingView } from '@/components/products/processing-view';
import { ReviewChanges } from '@/components/products/review-changes';
import { Button } from '@/components/ui/button';
import { File, PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

function ProductsPageContent() {
  const { workflowStep, setWorkflowStep, searchTerm, setSearchTerm } = useProductContext();

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
        <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input
                type="search"
                placeholder="Search products by name, description, brand, or ID..."
                className="w-full appearance-none bg-background pl-8 shadow-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
        </div>
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
