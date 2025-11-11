
'use client';

import { useState, useCallback } from 'react';
import { useProductContext } from '@/contexts/product-context';
import { processPriceList } from '@/app/dashboard/products/actions';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function FileUpload() {
  const { products, setWorkflowStep, setAiResponse } = useProductContext();
  const [file, setFile] = useState<File | null>(null);
  const [vendor, setVendor] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    }
  });

  const handleProcessFile = async () => {
    if (!file || !vendor) return;

    setWorkflowStep('processing');
    const reader = new FileReader();

    const processAsText = (fileContent: string) => {
        return processPriceList(products, fileContent, vendor, file.type);
    };

    const processAsBase64 = (fileContent: string) => {
        // We send the base64 string directly to the AI
        return processPriceList(products, fileContent, vendor, file.type);
    }

    reader.onload = async (e) => {
      const result = e.target?.result as string;
      let response;
      if (file.type.startsWith('image/')) {
        response = await processAsBase64(result);
      } else {
        response = await processAsText(result);
      }
      setAiResponse(response);
      setWorkflowStep('review');
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-muted/20 rounded-lg border-2 border-dashed">
      <h2 className="text-2xl font-bold mb-4">Upload Price List</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Select a vendor and upload your price list file (CSV, PDF, or even an image). The AI will analyze it and suggest catalog updates.
      </p>

      <div className="w-full max-w-sm space-y-4 mb-8">
        <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="vendor-select">Select Vendor</Label>
            <Select onValueChange={setVendor} value={vendor}>
                <SelectTrigger id="vendor-select">
                    <SelectValue placeholder="Choose a vendor..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="vendor-a">Vendor A</SelectItem>
                    <SelectItem value="vendor-b">Vendor B</SelectItem>
                    <SelectItem value="vendor-c">Vendor C</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-4">
            <UploadCloud className="w-12 h-12 text-muted-foreground" />
            {file ? (
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileIcon className="h-4 w-4"/>
                <span>{file.name}</span>
              </div>
            ) : (
              <p>Drag & drop a file here, or click to select</p>
            )}
          </div>
        </div>
      </div>

      <Button onClick={handleProcessFile} disabled={!file || !vendor}>
        Process File
      </Button>
    </div>
  );
}
