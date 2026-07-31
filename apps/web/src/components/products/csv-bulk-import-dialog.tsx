'use client';

import {
  CheckCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  type ProductCsvImportResultData,
  uploadProductCsv,
} from '@/lib/imports/upload-product-csv';

interface CSVBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function CSVBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CSVBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ProductCsvImportResultData | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    // Professional sample data to help merchants understand the format
    const csvContent = `name,description,price,stock_quantity,category,sku,status
"Classic Cotton T-Shirt","Soft, breathable cotton t-shirt perfect for everyday wear. Available in multiple colors.",24.99,150,"Apparel","TEE-001","active"
"Wireless Bluetooth Earbuds","Premium sound quality with noise cancellation. Up to 8 hours battery life.",79.99,45,"Electronics","AUDIO-001","active"
"Organic Hand Cream","Nourishing hand cream with shea butter and essential oils. 100ml bottle.",12.99,200,"Beauty","BEAUTY-001","active"
"Leather Laptop Sleeve","Genuine leather sleeve fits 13-15 inch laptops. Protective padding inside.",59.99,0,"Accessories","BAG-001","draft"`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'product-import-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Clean up object URL to prevent memory leak
    URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'CSV template has been downloaded successfully.',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type !== 'text/csv' &&
        !selectedFile.name.endsWith('.csv')
      ) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a CSV file.',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress while the request is in flight.
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    return uploadProductCsv(file)
      .then((outcome) => {
        if (outcome.status === 'ok') {
          const { data } = outcome;
          setResult(data);
          toast({
            title: 'Import Complete',
            description: `Successfully imported ${data.success} products. ${data.failed} failed.`,
          });
          if (data.success > 0) {
            onImportComplete();
          }
        } else {
          console.error('Upload error:', outcome.error);
          toast({
            title: 'Upload Failed',
            description:
              'There was an error uploading your file. Please try again.',
            variant: 'destructive',
          });
        }
      })
      .catch((error: unknown) => {
        console.error('Unexpected upload flow error:', error);
        toast({
          title: 'Upload Failed',
          description:
            'There was an error uploading your file. Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        setIsUploading(false);
      });
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setUploadProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once. Download the
            template to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Download Template */}
          <div className="space-y-2">
            <Label>1. Download Template</Label>
            <Button
              variant="outline"
              className="w-full"
              onClick={downloadTemplate}
              type="button"
            >
              <Download className="mr-2 size-4" />
              Download CSV Template
            </Button>
            <p className="text-xs text-muted-foreground">
              Download the template, fill in your products, and upload it below.
            </p>
          </div>

          {/* Upload File */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">2. Upload Filled CSV</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="size-4" />
                {file.name}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <Label>Uploading…</Label>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Results */}
          {result && (
            <Alert
              className={
                result.failed === 0 ? 'border-green-500' : 'border-yellow-500'
              }
            >
              <div className="flex items-start gap-2">
                {result.failed === 0 ? (
                  <CheckCircle className="size-4 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-yellow-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <p className="font-medium">
                      {result.success} products imported successfully
                      {result.failed > 0 && `, ${result.failed} failed`}
                    </p>
                    {result.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium">Errors:</p>
                        <ul className="text-xs list-disc list-inside space-y-1">
                          {result.errors.slice(0, 5).map((error, index) => (
                            <li
                              // biome-ignore lint/suspicious/noArrayIndexKey: Error messages have no stable ID
                              key={index}
                            >
                              {error}
                            </li>
                          ))}
                          {result.errors.length > 5 && (
                            <li>…and {result.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Import Products
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
