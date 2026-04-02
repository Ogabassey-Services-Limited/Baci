'use client';

import {
  AlertCircle,
  Check,
  FolderOpen,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface MediaFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  createdAt: string;
}

interface MediaLibraryProps {
  onSelect?: (url: string) => void;
  maxSizeMB?: number;
}

export function MediaLibrary({ onSelect, maxSizeMB = 5 }: MediaLibraryProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing files
  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/media');
      if (!response.ok) throw new Error('Failed to load media');
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error loading media:', error);
      toast({
        title: 'Error',
        description: 'Failed to load media library',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load files on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadFiles is stable, only run on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Handle file upload
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPG, PNG, GIF, WebP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${maxSizeMB}MB. Your file is ${sizeMB.toFixed(1)}MB`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      toast({
        title: 'Upload successful',
        description: `${file.name} has been uploaded`,
      });

      // Reload files
      await loadFiles();

      // Auto-select the uploaded file if onSelect is provided
      if (onSelect && data.file?.url) {
        setSelectedFile(data.file.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: (error as Error).message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;

    try {
      const response = await fetch(`/api/media?id=${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      toast({
        title: 'Deleted',
        description: `${fileName} has been deleted`,
      });

      await loadFiles();

      if (selectedFile === fileId) {
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // Filter files by search query
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Media Library</h2>
          <p className="text-sm text-muted-foreground">
            Upload and manage your images
          </p>
        </div>

        {/* Upload Area */}
        <Card
          className={cn(
            'relative border-2 border-dashed transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-muted',
            uploading && 'opacity-50 pointer-events-none'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />

          <div className="p-8 flex flex-col items-center justify-center text-center">
            {uploading ? (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-1">Upload Image</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop or click to browse
                </p>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  JPG, PNG, GIF, WebP • Max {maxSizeMB}MB
                </p>
              </>
            )}
          </div>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Files Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card className="p-8 flex flex-col items-center justify-center text-center bg-muted/50">
            {searchQuery ? (
              <>
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No images found for "{searchQuery}"
                </p>
              </>
            ) : (
              <>
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No images yet. Upload your first image above!
                </p>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredFiles.map((file) => (
              <Card
                key={file.id}
                className={cn(
                  'relative group overflow-hidden cursor-pointer transition-all',
                  selectedFile === file.url && 'ring-2 ring-primary'
                )}
                onClick={() => {
                  setSelectedFile(file.url);
                  if (onSelect) {
                    onSelect(file.url);
                  }
                }}
              >
                {/* Image */}
                <div className="aspect-square relative bg-muted">
                  <Image
                    src={file.url}
                    alt={file.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 384px"
                    className="object-cover"
                  />

                  {/* Selection indicator */}
                  {selectedFile === file.url && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <CopyButton
                      value={file.url}
                      className="h-8 w-8 bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0"
                      label="Copy URL"
                      successLabel="Copied!"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id, file.name);
                      }}
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* File info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tips */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            Media Library Tips
          </h4>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• Optimize images before uploading for faster loading</li>
            <li>• Use WebP format for best compression</li>
            <li>• Recommended max width: 2000px for most images</li>
            <li>• Product images: 1000x1000px square</li>
            <li>• Click on an image to select it and copy the URL</li>
          </ul>
        </Card>
      </div>
    </ScrollArea>
  );
}
