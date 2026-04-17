'use client';

import {
  CheckCircle,
  ChevronDown,
  Image as ImageIcon,
  PlusCircle,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GoogleSheetIcon } from './google-sheet-icon';

interface ProductsPageActionsProps {
  hasConnectedGoogleSheet: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  onBulkPublish: () => Promise<void>;
  onCsvImport: () => void;
  onUploadImage: () => void;
  onSyncGoogleSheet: () => Promise<void>;
  onDisconnectSheet: () => Promise<void>;
  onGoogleSheetImport: () => void;
  onJumiaImport: () => Promise<void>;
  onFixImages: () => void;
  onAddProduct: () => void;
}

export function ProductsPageActions({
  hasConnectedGoogleSheet,
  isLoading,
  isSyncing,
  onBulkPublish,
  onCsvImport,
  onUploadImage,
  onSyncGoogleSheet,
  onDisconnectSheet,
  onGoogleSheetImport,
  onJumiaImport,
  onFixImages,
  onAddProduct,
}: ProductsPageActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1 text-green-600 border-green-300 hover:bg-green-50"
        onClick={() => {
          void onBulkPublish();
        }}
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
        onClick={onCsvImport}
      >
        <Send className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Upload CSV
        </span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1"
        onClick={onUploadImage}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Upload Image
        </span>
      </Button>
      {hasConnectedGoogleSheet ? (
        <div className="flex items-center">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-r-none border-r-0"
            onClick={() => {
              void onSyncGoogleSheet();
            }}
            disabled={isSyncing || isLoading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Sync Sheet
            </span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-2 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-l-none border-l-0"
                disabled={isSyncing || isLoading}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="sr-only">Options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  void onDisconnectSheet();
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect Sheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1"
          onClick={onGoogleSheetImport}
        >
          <GoogleSheetIcon />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Import from Google Sheet
          </span>
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
        onClick={() => {
          void onJumiaImport();
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Jumia Import
        </span>
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary"
        onClick={onFixImages}
      >
        <ImageIcon className="h-4 w-4" />
        Fix Images
      </Button>
      <Button size="sm" className="h-9 gap-1" onClick={onAddProduct}>
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Add Product
        </span>
      </Button>
    </div>
  );
}
