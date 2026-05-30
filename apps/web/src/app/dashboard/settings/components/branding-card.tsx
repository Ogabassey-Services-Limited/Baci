'use client';

import { CheckCircle, Loader2, Pencil, Shuffle, Upload } from 'lucide-react';
import Image from 'next/image';
import { ColorPicker } from '@/components/color-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CachedMerchant } from '@/lib/cached-data';
import { cn } from '@/lib/utils';
import type { BrandColors } from '@/types';

interface BrandingCardProps {
  merchantState: CachedMerchant;
  brandColors: BrandColors | undefined;
  isUploading: boolean;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onColorChange: (role: keyof BrandColors, newColor: string) => void;
  onShuffleColors: () => void;
}

export function BrandingCard({
  merchantState,
  brandColors,
  isUploading,
  onLogoUpload,
  onColorChange,
  onShuffleColors,
}: BrandingCardProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Manage your store's logo and color scheme.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Label>Logo</Label>
          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-4 h-48 w-full flex flex-col items-center justify-center text-center transition-colors',
              merchantState.logo_url
                ? 'border-green-500 bg-green-50/50'
                : 'border-muted-foreground/50'
            )}
          >
            {merchantState.logo_url ? (
              <>
                <Image
                  src={merchantState.logo_url}
                  alt="Uploaded Logo Preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 200px"
                  className="rounded-md p-2 object-contain"
                />
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md">
                  <CheckCircle className="size-4 text-white" />
                </div>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload new logo
                </p>
              </>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                <Loader2 className="size-8 motion-safe:animate-spin text-primary" />
              </div>
            )}
            <Input
              id="logo-upload"
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="image/*"
              onChange={onLogoUpload}
              aria-label="Upload logo file"
              disabled={isUploading}
            />
          </div>
        </div>
        <div className="space-y-4">
          <Label>Brand Colors</Label>
          {brandColors ? (
            <div className="flex items-center gap-4">
              <div className="flex gap-4">
                {(['primary', 'background', 'accent'] as const).map((role) => (
                  <div
                    key={role}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="size-12 rounded-full border-2 cursor-pointer relative group"
                          aria-label={`Edit ${role} color`}
                        >
                          <div
                            className="w-full h-full rounded-full"
                            style={{
                              backgroundColor: brandColors[role],
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="size-5 text-white" />
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto">
                        <ColorPicker
                          color={brandColors[role]}
                          onChange={(newColor) => onColorChange(role, newColor)}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs font-medium capitalize h-4 block text-muted-foreground">
                      {role}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onShuffleColors}
                disabled={isUploading}
                aria-label="Shuffle Colors"
              >
                <Shuffle className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload a logo to generate brand colors.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
