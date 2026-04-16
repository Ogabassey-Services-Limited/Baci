'use client';

import { ArrowLeft } from 'lucide-react';
import { FileUpload } from '@/components/products/file-upload';
import { MissingImagesView } from '@/components/products/missing-images-view';
import { ProcessingView } from '@/components/products/processing-view';
import { ProductCatalog } from '@/components/products/product-catalog';
import { ReviewChanges } from '@/components/products/review-changes';
import { Button } from '@/components/ui/button';
import type { WorkflowStep } from '@/contexts/product-context';
import type { Product } from '@/lib/products';

interface ProductsPageWorkflowContentProps {
  workflowStep: WorkflowStep;
  statusFilter: string;
  stockFilter: string;
  onSetWorkflowStep: (step: WorkflowStep) => void;
  onReviewComplete: () => Promise<void>;
  onEditProduct: (product: Product | null) => void;
}

export function ProductsPageWorkflowContent({
  workflowStep,
  statusFilter,
  stockFilter,
  onSetWorkflowStep,
  onReviewComplete,
  onEditProduct,
}: ProductsPageWorkflowContentProps) {
  switch (workflowStep) {
    case 'upload':
      return <FileUpload />;
    case 'processing':
      return <ProcessingView />;
    case 'studio':
      return (
        <>
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" onClick={() => onSetWorkflowStep('view')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </div>
          <MissingImagesView />
        </>
      );
    case 'review':
      return <ReviewChanges onComplete={onReviewComplete} />;
    default:
      return (
        <ProductCatalog
          statusFilter={statusFilter}
          stockFilter={stockFilter}
          onEditProduct={onEditProduct}
        />
      );
  }
}
