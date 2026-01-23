'use client';

import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 2026 Best Practice: Track whether preview is from initialFiles or new upload
// This prevents index mismatch when removing files
interface PreviewEntry {
  src: string;
  file: File | null; // null for initialFiles URLs
}

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
  // Use unified entries to track both initialFiles (URLs) and new uploads (File objects)
  const [entries, setEntries] = useState<PreviewEntry[]>(() =>
    initialFiles.map((src) => ({ src, file: null }))
  );
  const [errors, setErrors] = useState<string[]>([]);

  // 2026 Best Practice: Use a ref to track the latest entries for safe revocation on unmount
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Cleanup object URLs to avoid memory leaks
  // Runs only on unmount to ensure URLs remain valid while the component is active
  useEffect(() => {
    return () => {
      for (const entry of entriesRef.current) {
        // Only revoke blob URLs (new uploads), not external URLs (initialFiles)
        if (entry.file && entry.src.startsWith('blob:')) {
          URL.revokeObjectURL(entry.src);
        }
      }
    };
  }, []);

  // Extract just the File objects for the callback
  const getFiles = (entryList: PreviewEntry[]): File[] =>
    entryList.flatMap((e) => (e.file ? [e.file] : []));

  const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Handle errors
    const newErrors: string[] = [];
    fileRejections.forEach(({ file, errors: fileErrors }) => {
      fileErrors.forEach((e) => {
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
      // Calculate remaining slots accounting for current entries
      const remainingSlots = Math.max(0, maxFiles - entries.length);
      const filesToAdd = acceptedFiles.slice(0, remainingSlots);

      if (filesToAdd.length === 0) return;

      // Create new entries with File objects
      const newEntries: PreviewEntry[] = filesToAdd.map((file) => ({
        src: URL.createObjectURL(file),
        file,
      }));

      const updatedEntries = [...entries, ...newEntries];
      setEntries(updatedEntries);
      onFilesSelected(getFiles(updatedEntries));
    }
  };

  const removeFile = (index: number) => {
    setEntries((prev) => {
      const entryToRemove = prev[index];
      // Revoke blob URL for new uploads
      if (entryToRemove?.file && entryToRemove.src.startsWith('blob:')) {
        URL.revokeObjectURL(entryToRemove.src);
      }
      const updated = prev.filter((_, i) => i !== index);
      onFilesSelected(getFiles(updated));
      return updated;
    });
  };

  // For compatibility with existing code that uses previews.length
  const previews = entries.map((e) => e.src);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Account for all entries when enforcing maxFiles limit
    maxFiles: Math.max(0, maxFiles - entries.length),
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
          entries.length >= maxFiles &&
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
