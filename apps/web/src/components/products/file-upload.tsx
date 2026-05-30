'use client';

import { File as FileIcon, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { processPriceList } from '@/app/dashboard/products/actions';
import { Button } from '@/components/ui/button';
import { useProductContext } from '@/contexts/product-context';

export function FileUpload() {
  const { products, setWorkflowStep, setAiResponse } = useProductContext();
  const [file, setFile] = useState<File | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  });

  const handleProcessFile = () => {
    if (!file) return;

    setWorkflowStep('processing');
    const reader = new FileReader();
    const vendor = 'Uploaded File'; // Use a generic vendor name

    const processAsText = (fileContent: string) => {
      return processPriceList(products, fileContent, vendor, file.type);
    };

    const processAsBase64 = (fileContent: string) => {
      // We send the base64 string directly to the AI
      return processPriceList(products, fileContent, vendor, file.type);
    };

    reader.onload = async (e) => {
      const result = e.target?.result as string;
      let response: Awaited<ReturnType<typeof processPriceList>>;
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
        Upload a picture of your price list, or a CSV/PDF file. The customized
        AI will analyze the image to identify products and prices.
      </p>

      <div className="w-full max-w-sm space-y-4 mb-8">
        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-4">
            <UploadCloud className="size-12 text-muted-foreground" />
            {file ? (
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileIcon className="size-4" />
                <span>{file.name}</span>
              </div>
            ) : (
              <p>Drag & drop a file here, or click to select</p>
            )}
          </div>
        </div>
      </div>

      <Button onClick={handleProcessFile} disabled={!file}>
        Process File
      </Button>
    </div>
  );
}
