'use client';

import { useState } from 'react';
import type { AIResponse } from '@/app/dashboard/products/actions';
import type { WorkflowStep } from '@/contexts/product-context';
import { apiPost } from '@/lib/api-client';
import type { Product } from '@/lib/products';

type ToastApi = (args: {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}) => unknown;

interface UseProductsPageActionsArgs {
  connectedSheetUrl?: string;
  merchantId?: string;
  products: Product[];
  toast: ToastApi;
  updateMerchant: (
    values: { google_product_sheet_url?: string },
    options?: { skipReload?: boolean }
  ) => Promise<void>;
  setWorkflowStep: (step: WorkflowStep) => void;
  setAiResponse: (response: AIResponse | null) => void;
  setSearchTerm: (value: string) => void;
}

export function useProductsPageActions({
  connectedSheetUrl,
  merchantId,
  products,
  toast,
  updateMerchant,
  setWorkflowStep,
  setAiResponse,
  setSearchTerm,
}: UseProductsPageActionsArgs) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSheetUrl, setPendingSheetUrl] = useState<string | null>(null);
  const [isGoogleSheetImportOpen, setIsGoogleSheetImportOpen] = useState(false);
  const [isCSVBulkImportOpen, setIsCSVBulkImportOpen] = useState(false);

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

      const lines = data.split('\n').filter((line) => line.trim());
      const directResult = await parseCSVDirectly(products, data);
      const hasStructuralError =
        !directResult ||
        directResult.summary?.includes('Could not find') ||
        directResult.summary?.includes('No data rows');
      const structuralSummary =
        directResult?.summary ??
        'Could not parse the pasted content. Please check the format.';

      let response: AIResponse;

      if (hasStructuralError) {
        if (lines.length > 50) {
          throw new Error(structuralSummary);
        }

        response = await processPriceList(products, data, vendor, fileType);
      } else {
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

  const submitCommand = async (query: string) => {
    if (!query.trim()) return;

    if (query.includes('\n')) {
      await startAiProcessing(query, 'pasted text', 'text');
    }
  };

  const handleBulkPublish = async () => {
    try {
      const result = await apiPost<{
        deletedDrafts: number;
        publishedProducts: number;
      }>('/api/products/bulk-publish');

      toast({
        title: 'Products Updated',
        description: `Deleted ${result.deletedDrafts} drafts, published ${result.publishedProducts} products.`,
      });
      window.location.reload();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to bulk publish products',
        variant: 'destructive',
      });
    }
  };

  const handleSyncGoogleSheet = async () => {
    if (!connectedSheetUrl) return;

    setIsSyncing(true);
    try {
      const { fetchGoogleSheet } = await import(
        '@/app/dashboard/products/actions'
      );
      const csvContent = await fetchGoogleSheet(connectedSheetUrl);

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

  const disconnectSheet = async () => {
    try {
      await updateMerchant({
        google_product_sheet_url: undefined,
      });
      toast({
        title: 'Sheet Disconnected',
        description: 'You can now connect a different sheet.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to disconnect sheet.',
        variant: 'destructive',
      });
    }
  };

  const handleJumiaImport = async () => {
    if (!merchantId) return;

    toast({
      title: 'Importing from Jumia...',
      description: 'Fetching products...',
    });

    try {
      const data = await apiPost<{
        summary: {
          created: number;
          linked: number;
        };
      }>('/api/marketplace/jumia/products/import', { merchantId });

      toast({
        title: 'Import Successful',
        description: `Created: ${data.summary.created}, Linked: ${data.summary.linked}`,
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleGoogleSheetImport = (
    data: string,
    url: string,
    saveUrl: boolean
  ) => {
    startAiProcessing(data, 'Google Sheet Import', 'csv');
    if (saveUrl && url !== connectedSheetUrl) {
      setPendingSheetUrl(url);
    }
  };

  const handleReviewComplete = async () => {
    if (!pendingSheetUrl) return;

    try {
      await updateMerchant(
        { google_product_sheet_url: pendingSheetUrl },
        { skipReload: true }
      );
      setPendingSheetUrl(null);
    } catch (error) {
      console.error('Failed to save sheet URL after import:', error);
    }
  };

  return {
    isSyncing,
    isGoogleSheetImportOpen,
    setIsGoogleSheetImportOpen,
    isCSVBulkImportOpen,
    setIsCSVBulkImportOpen,
    handleBulkPublish,
    handleSyncGoogleSheet,
    disconnectSheet,
    handleJumiaImport,
    handleGoogleSheetImport,
    handleReviewComplete,
    submitCommand,
  };
}
