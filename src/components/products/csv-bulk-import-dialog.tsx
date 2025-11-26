'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface CSVBulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportComplete: () => void;
}

export function CSVBulkImportDialog({ open, onOpenChange, onImportComplete }: CSVBulkImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const csvContent = `name,description,price,stock_quantity,category,sku,status
"Sample Product 1","This is a sample product description",29.99,100,"Electronics","SKU001","active"
"Sample Product 2","Another sample product",49.99,50,"Clothing","SKU002","active"
"Sample Product 3","Third sample product",19.99,0,"Books","SKU003","draft"`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'product-import-template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Template Downloaded',
            description: 'CSV template has been downloaded successfully.',
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
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

    const handleUpload = async () => {
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

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 200);

            const response = await fetch('/api/products/bulk-import', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            setResult(data);

            toast({
                title: 'Import Complete',
                description: `Successfully imported ${data.success} products. ${data.failed} failed.`,
            });

            if (data.success > 0) {
                onImportComplete();
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload Failed',
                description: 'There was an error uploading your file. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
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
                        Upload a CSV file to import multiple products at once. Download the template to get started.
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
                            <Download className="mr-2 h-4 w-4" />
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
                                <FileSpreadsheet className="h-4 w-4" />
                                {file.name}
                            </p>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {isUploading && (
                        <div className="space-y-2">
                            <Label>Uploading...</Label>
                            <Progress value={uploadProgress} />
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <Alert className={result.failed === 0 ? 'border-green-500' : 'border-yellow-500'}>
                            <div className="flex items-start gap-2">
                                {result.failed === 0 ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
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
                                                        <li key={index}>{error}</li>
                                                    ))}
                                                    {result.errors.length > 5 && (
                                                        <li>...and {result.errors.length - 5} more errors</li>
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
                    <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                        {result ? 'Close' : 'Cancel'}
                    </Button>
                    {!result && (
                        <Button onClick={handleUpload} disabled={!file || isUploading}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
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
