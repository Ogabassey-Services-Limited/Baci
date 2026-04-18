'use client';

import { AlertCircle } from 'lucide-react';
import AddProductForm from '@/app/dashboard/products/add/add-product-form';
import { CSVBulkImportDialog } from '@/components/products/csv-bulk-import-dialog';
import { GoogleSheetImportDialog } from '@/components/products/google-sheet-import-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Product } from '@/lib/products';

interface ProductsPageDialogsProps {
  editingProduct: Product | null;
  isAddProductOpen: boolean;
  isGoogleSheetImportOpen: boolean;
  isCSVBulkImportOpen: boolean;
  connectedSheetUrl?: string;
  onAddProductOpenChange: (open: boolean) => void;
  onProductSaved: (product: Product) => Promise<void>;
  onCancelAddProduct: () => void;
  onGoogleSheetImportOpenChange: (open: boolean) => void;
  onGoogleSheetImport: (data: string, url: string, saveUrl: boolean) => void;
  onCsvImportOpenChange: (open: boolean) => void;
}

export function ProductsPageDialogs({
  editingProduct,
  isAddProductOpen,
  isGoogleSheetImportOpen,
  isCSVBulkImportOpen,
  connectedSheetUrl,
  onAddProductOpenChange,
  onProductSaved,
  onCancelAddProduct,
  onGoogleSheetImportOpenChange,
  onGoogleSheetImport,
  onCsvImportOpenChange,
}: ProductsPageDialogsProps) {
  return (
    <>
      <Dialog open={isAddProductOpen} onOpenChange={onAddProductOpenChange}>
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
          {editingProduct?.migration_status === 'needs_review' ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              <AlertTitle>Review before saving</AlertTitle>
              <AlertDescription>
                Confirm the default variant, variant conditions, and price/stock
                values. Saving a valid SKU matrix will clear this review item
                from the queue.
              </AlertDescription>
            </Alert>
          ) : null}
          <AddProductForm
            onProductAdded={onProductSaved}
            onCancel={onCancelAddProduct}
            initialData={editingProduct}
          />
        </DialogContent>
      </Dialog>

      <GoogleSheetImportDialog
        open={isGoogleSheetImportOpen}
        onOpenChange={onGoogleSheetImportOpenChange}
        initialUrl={connectedSheetUrl}
        onImport={onGoogleSheetImport}
      />

      <CSVBulkImportDialog
        open={isCSVBulkImportOpen}
        onOpenChange={onCsvImportOpenChange}
        onImportComplete={() => window.location.reload()}
      />
    </>
  );
}
