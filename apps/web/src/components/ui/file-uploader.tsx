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

// Extract just the File objects for the callback
const getFiles = (entryList: PreviewEntry[]): File[] =>
  entryList.flatMap((e) => (e.file ? [e.file] : []));

// Helper to create a stable reference based on content
// 2026 Best Practice: Prevent unnecessary effect re-runs using shallow comparison instead of heavy JSON.stringify
function useStableArray<T>(arr: T[]): T[] {
  const ref = useRef<T[]>(arr);
  const prevArr = useRef<T[]>(arr);

  const changed =
    arr.length !== prevArr.current.length ||
    arr.some((item, i) => item !== prevArr.current[i]);

  if (changed) {
    prevArr.current = arr;
    ref.current = arr;
  }

  return ref.current;
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
  const [announcement, setAnnouncement] = useState<string>('');
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Helper to set announcement and auto-clear after delay
  const announce = (message: string) => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
    setAnnouncement(message);
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement('');
      announcementTimeoutRef.current = null;
    }, 2000);
  };

  // 2026 Best Practice: Use a ref to track the latest entries for safe revocation on unmount
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // 2026 Best Practice: Use a ref to track previous files to avoid spurious callback triggers
  const prevFilesRef = useRef<File[]>([]);

  // 2026 Best Practice: Separate state updates from side effects to ensure purity in Strict Mode
  const didMountRef = useRef(false);
  useEffect(() => {
    const currentFiles = getFiles(entries);

    if (!didMountRef.current) {
      didMountRef.current = true;
      prevFilesRef.current = currentFiles;
      return;
    }

    // Only trigger callback if the File list has actually changed (prevents loops/dirty forms on URL-only sync)
    const isSame =
      currentFiles.length === prevFilesRef.current.length &&
      currentFiles.every((f, i) => f === prevFilesRef.current[i]);

    if (!isSame) {
      prevFilesRef.current = currentFiles;
      onFilesSelected(currentFiles);
    }
  }, [entries, onFilesSelected]);

  const stableInitialFiles = useStableArray(initialFiles);

  // Sync initialFiles prop changes to state while preserving new uploads
  // This allows parent forms to update (e.g. from DB) without losing work
  useEffect(() => {
    setEntries((prev) => {
      const newInitialEntries = stableInitialFiles.map((src) => ({
        src,
        file: null,
      }));
      const fileEntries = prev.filter((e) => e.file !== null);
      return [...newInitialEntries, ...fileEntries];
    });
  }, [stableInitialFiles]);

  // Cleanup object URLs and announcement timeout to avoid memory leaks
  // Runs only on unmount to ensure URLs remain valid while the component is active
  useEffect(() => {
    return () => {
      for (const entry of entriesRef.current) {
        // Only revoke blob URLs (new uploads), not external URLs (initialFiles)
        if (entry.file && entry.src.startsWith('blob:')) {
          URL.revokeObjectURL(entry.src);
        }
      }
      // Clear announcement timeout on unmount
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

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
      // 2026 Best Practice: Create blob URLs outside state updater to avoid orphans in Strict Mode
      const potentialEntries: PreviewEntry[] = acceptedFiles.map((file) => ({
        src: URL.createObjectURL(file), // Side effect happens once
        file,
      }));

      // 2026 Best Practice: Separate state calculation from side effects
      setEntries((prev) => {
        const remainingSlots = Math.max(0, maxFiles - prev.length);
        const entriesToAdd = potentialEntries.slice(0, remainingSlots);

        // Revoke unused blob URLs immediately
        const unusedEntries = potentialEntries.slice(remainingSlots);
        for (const e of unusedEntries) {
          URL.revokeObjectURL(e.src);
        }

        if (entriesToAdd.length === 0) {
          announce('No files added. Upload limit reached.');
          return prev;
        }

        // Announce addition separately to maintain pure state updates
        const addedCount = entriesToAdd.length;
        const ignoredCount = potentialEntries.length - remainingSlots;
        const msg = `Added ${addedCount} file${addedCount === 1 ? '' : 's'}.${ignoredCount > 0 ? ` ${ignoredCount} file(s) ignored due to limit.` : ''}`;
        announce(msg);

        return [...prev, ...entriesToAdd];
      });
    }
  };

  const removeFile = (index: number) => {
    // Announce removal before state update (since we need the current list)
    const entry = entries[index];
    if (entry) {
      const name = entry.file?.name || `Image ${index + 1}`;
      setAnnouncement(`${name} removed`);
    }

    setEntries((prev) => {
      const entryToRemove = prev[index];
      // Revoke blob URL for new uploads
      if (entryToRemove?.file && entryToRemove.src.startsWith('blob:')) {
        URL.revokeObjectURL(entryToRemove.src);
      }
      const fileName = entryToRemove?.file?.name ?? `Image ${index + 1}`;
      announce(`Removed ${fileName}.`);
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Enforce total limit; onDrop handles the atomic slice based on current state
    maxFiles,
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

      {/* Screen reader announcement for file upload results */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="uploader-announcement"
      >
        {announcement}
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

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {entries.map((entry, index) => (
            <div
              key={`${entry.src}-${index}`}
              className="relative group aspect-square rounded-md overflow-hidden border bg-muted"
            >
              <Image
                src={entry.src}
                alt={
                  entry.file
                    ? `Preview of ${entry.file.name}`
                    : `Preview ${index + 1}`
                }
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                className="object-cover transition-transform group-hover:scale-105"
                unoptimized
              />
              {/* 2026 Accessibility: focus-within:opacity-100 ensures keyboard users can see the remove button */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={
                    entry.file
                      ? `Remove ${entry.file.name}`
                      : `Remove image ${index + 1}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </div>
  );
}
