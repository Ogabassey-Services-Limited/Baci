'use client';

import AddProductForm from '@/app/dashboard/products/add/add-product-form';
import { CSVBulkImportDialog } from '@/components/products/csv-bulk-import-dialog';
import { GoogleSheetImportDialog } from '@/components/products/google-sheet-import-dialog';
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
