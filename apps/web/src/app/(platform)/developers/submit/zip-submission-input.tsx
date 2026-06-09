'use client';

import { AlertCircle, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ZipSubmissionInputProps {
  error: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function ZipSubmissionInput({
  error,
  file,
  onFileChange,
}: ZipSubmissionInputProps) {
  return (
    <div className="space-y-3">
      <Label htmlFor="file" className="text-gray-700">
        Project Archive
      </Label>
      <label
        htmlFor="file"
        className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white hover:bg-gray-50/50 transition-colors cursor-pointer"
      >
        <Upload className="size-8 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-900">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-gray-500 mt-1">ZIP, TAR up to 50MB</p>
        {file ? (
          <p className="text-xs text-blue-700 mt-3">Selected: {file.name}</p>
        ) : null}
      </label>
      <Input
        id="file"
        name="file"
        type="file"
        accept=".zip,.tar,.tgz,.tar.gz"
        className="sr-only"
        aria-describedby={error ? 'file-error' : undefined}
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
        }}
      />
      {error ? (
        <p
          id="file-error"
          className="text-xs text-red-600 flex items-center"
          role="alert"
        >
          <AlertCircle className="size-3 mr-1" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
