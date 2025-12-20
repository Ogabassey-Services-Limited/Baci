'use client';

import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  className?: string;
  initialFiles?: string[]; // URLs of existing files
}

export function FileUploader({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
  },
  className,
  initialFiles = [],
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(initialFiles);
  const [errors, setErrors] = useState<string[]>([]);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (typeof file === 'object' && 'preview' in file) {
          URL.revokeObjectURL((file as File & { preview: string }).preview);
        }
      });
    };
  }, [files]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Handle errors
      const newErrors: string[] = [];
      fileRejections.forEach(({ file, errors }) => {
        errors.forEach((e) => {
          if (e.code === 'file-too-large') {
            newErrors.push(
              `${file.name} is too large. Max size is ${maxSize / 1024 / 1024}MB`
            );
          } else if (e.code === 'file-invalid-type') {
            newErrors.push(`${file.name} has an invalid file type.`);
          } else {
            newErrors.push(`${file.name}: ${e.message}`);
          }
        });
      });
      setErrors(newErrors);

      // Handle accepted files
      if (acceptedFiles?.length) {
        const newFiles = acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );

        setFiles((prev) => {
          const updated = [...prev, ...newFiles].slice(0, maxFiles);
          onFilesSelected(updated);
          return updated;
        });

        // Update previews for display (mixing File objects with preview URLs and initial string URLs)
        setPreviews((prev) => {
          const newPreviews = newFiles.map(
            (f) => (f as File & { preview: string }).preview
          );
          return [...prev, ...newPreviews].slice(0, maxFiles);
        });
      }
    },
    [maxFiles, maxSize, onFilesSelected]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onFilesSelected(updated);
      return updated;
    });
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: maxFiles - files.length, // Adjust max files based on what's already selected
    maxSize,
    accept,
  });

  return (
    <div className={cn('space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          files.length + (initialFiles?.length || 0) >= maxFiles &&
            'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="p-3 rounded-full bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop files here'
                : 'Drag & drop files here, or click to select'}
            </p>
            <p className="text-xs text-muted-foreground">
              Supported formats: PNG, JPG, WebP (Max {maxSize / 1024 / 1024}MB)
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertCircle className="h-4 w-4" />
            <span>Upload Errors</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            {errors.map((err, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Error messages are strings and order doesn't matter for display
              <li key={`${err}-${i}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {previews.map((src, index) => (
            <div
              key={src}
              className="relative group aspect-square rounded-md overflow-hidden border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image
                src={src}
                alt={`Preview ${index + 1}`}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
