import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { CAC_ACCEPTED_FILE_TYPES } from './cac-file-validation';

interface CacUploadStepProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  filePreview: string | null;
  onBack: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  selectedFile: File | null;
  uploading: boolean;
}

export function CacUploadStep({
  fileInputRef,
  filePreview,
  onBack,
  onFileChange,
  onUpload,
  selectedFile,
  uploading,
}: CacUploadStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload your CAC certificate (JPEG, PNG, WebP, or PDF, max 5 MB).
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={CAC_ACCEPTED_FILE_TYPES}
        onChange={onFileChange}
        disabled={uploading}
        aria-label="CAC certificate file upload"
        className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {selectedFile && (
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
          {filePreview && (
            // biome-ignore lint/performance/noImgElement: local blob URL preview, next/image doesn't support blob URLs
            <img
              src={filePreview}
              alt="Certificate preview"
              className="mt-2 max-h-48 rounded-md object-contain"
            />
          )}
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button onClick={onUpload} disabled={uploading || !selectedFile}>
          {uploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          Verify Certificate
        </Button>
      </div>
    </div>
  );
}
