'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { processFavicon } from '@/lib/favicon-processor';
import { createClient } from '@/lib/supabase/client';
import { useMerchant } from '@/hooks/use-merchant';
import { Upload, Loader2 } from 'lucide-react';
import Image from 'next/image';

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

        setUploading(true);

        try {
            // Process and upload
            const result = await processFavicon(file, merchant.id);

            // Update merchant record
            const supabase = createClient();
            const { error } = await supabase
                .from('merchants')
                .update({
                    favicon_svg_url: result.svg_url,
                    favicon_png_32_url: result.png_32_url,
                    favicon_png_192_url: result.png_192_url,
                    favicon_apple_touch_url: result.apple_touch_url,
                    favicon_uploaded_at: new Date().toISOString(),
                })
                .eq('id', merchant.id);

            if (error) throw error;

            toast({
                title: 'Favicon updated',
                description: 'Your store favicon has been updated successfully',
            });

            setPreview(result.png_32_url);

            // Refresh merchant data
            reloadMerchant();
        } catch (error) {
            console.error('Favicon upload failed:', error);
            toast({
                title: 'Upload failed',
                description: 'Could not update favicon. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="favicon-upload" className="block text-sm font-medium mb-2">
                    Store Favicon
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                    Upload your store icon (SVG or PNG, max 1MB). Recommended: 512x512px square logo or icon.
                </p>
            </div>

            {(preview || merchant?.favicon_png_32_url) && (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="relative w-8 h-8">
                        <Image
                            src={preview || merchant.favicon_png_32_url}
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
                <label
                    htmlFor="favicon-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                </label>
                <input
                    id="favicon-upload"
                    type="file"
                    accept="image/svg+xml,image/png"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="sr-only"
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
