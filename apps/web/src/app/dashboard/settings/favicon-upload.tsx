'use client';

import { Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { uploadFavicon } from '@/app/dashboard/settings/actions';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
// import { createClient } from '@/lib/supabase/client'; // Not needed anymore

export function FaviconUpload() {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { merchant, reloadMerchant } = useMerchant();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/svg+xml', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an SVG or PNG file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1048576) {
      toast({
        title: 'File too large',
        description: 'Favicon must be under 1MB',
        variant: 'destructive',
      });
      return;
    }

    if (!merchant) {
      toast({
        title: 'Error',
        description: 'Merchant information not available',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await uploadFavicon(formData, merchant.id);

      if (!response.success || !response.result) {
        throw new Error(response.error || 'Upload failed');
      }

      toast({
        title: 'Favicon updated',
        description: 'Your store favicon has been updated successfully',
      });

      setPreview(response.result.png_32_url);

      // Refresh merchant data
      reloadMerchant();
    } catch (error) {
      console.error('Favicon upload failed:', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not update favicon. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="favicon-upload"
          className="block text-sm font-medium mb-2"
        >
          Store Favicon
        </label>
        <p className="text-sm text-muted-foreground mb-4">
          Upload your store icon (SVG or PNG, max 1MB). Recommended: 512x512px
          square logo or icon.
        </p>
      </div>

      {(preview || merchant?.favicon_png_32_url) && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="relative w-8 h-8">
            <Image
              src={preview || merchant?.favicon_png_32_url || ''}
              alt="Current favicon"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span className="text-sm text-muted-foreground">Current favicon</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Replaced label with button for better semantics and accessibility */}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => document.getElementById('favicon-upload')?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Favicon
            </>
          )}
        </button>
        <input
          id="favicon-upload"
          type="file"
          accept="image/svg+xml,image/png"
          onChange={handleUpload}
          disabled={uploading}
          className="sr-only"
          aria-label="Upload favicon file" // Explicit label
        />
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>✓ SVG files are recommended for best quality</p>
        <p>✓ PNG files should be at least 512x512 pixels</p>
        <p>✓ Simple, recognizable icons work best at small sizes</p>
      </div>
    </div>
  );
}
