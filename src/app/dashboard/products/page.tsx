
'use client';

import { ProductProvider, useProductContext } from '@/contexts/product-context';
import { ProductCatalog } from '@/components/products/product-catalog';
import { FileUpload } from '@/components/products/file-upload';
import { ProcessingView } from '@/components/products/processing-view';
import { ReviewChanges } from '@/components/products/review-changes';
import { CommandBar } from '@/components/products/command-bar';
import { Button } from '@/components/ui/button';
import { File, PlusCircle } from 'lucide-react';
import Link from 'next/link';

function ProductsPageContent() {
  const { workflowStep, setWorkflowStep } = useProductContext();

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
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="ml-auto flex items-center gap-2">
           <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setWorkflowStep('upload')}>
              <File className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Import Price List
              </span>
            </Button>
          <Link href="/dashboard/products/add">
            <Button size="sm" className="h-8 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Product
              </span>
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex-1 flex flex-col">{renderContent()}</div>
      {workflowStep === 'view' && <CommandBar />}
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
