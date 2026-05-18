'use client';

import { removeBackground } from '@imgly/background-removal';
import {
  Camera,
  Check,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface AIStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (imageUrl: string) => void;
  productName: string;
}

export function AIStudio({
  isOpen,
  onClose,
  onSuccess,
  productName,
}: AIStudioProps) {
  const [step, setStep] = useState<'capture' | 'processing' | 'preview'>(
    'capture'
  );
  const [_originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const _canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setOriginalImage(null);
      setProcessedImage(null);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview of original
    const url = URL.createObjectURL(file);
    processImage(url);
  };

  const processImage = async (imageUrl: string) => {
    setStep('processing');
    setLoadingText('Loading AI Model (this happens once)...');

    try {
      setLoadingText('Removing background...');
      const blob = await removeBackground(imageUrl, {
        progress: (_key: string, current: number, total: number) => {
          setLoadingText(
            `AI Processing: ${Math.round((current / total) * 100)}%`
          );
        },
      });

      // Composite onto white background
      setLoadingText('Compositing studio background...');
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      // Set canvas size (square for e-commerce)
      const size = Math.max(imageBitmap.width, imageBitmap.height);
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Center image
      const x = (size - imageBitmap.width) / 2;
      const y = (size - imageBitmap.height) / 2;
      ctx.drawImage(imageBitmap, x, y);

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setProcessedImage(finalDataUrl);
      setStep('preview');
    } catch (error) {
      console.error('Background removal failed:', error);
      toast({
        title: 'AI Processing Failed',
        description: 'Could not remove background. Please try a clearer image.',
        variant: 'destructive',
      });
      setStep('capture');
    }
  };

  const handleSave = async () => {
    if (!processedImage) return;
    setIsUploading(true);

    try {
      const supabase = createClient();

      // Convert Data URL to Blob
      const res = await fetch(processedImage);
      const blob = await res.blob();

      // Upload to Supabase
      const filename = `studio-${Date.now()}-${productName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg`;
      const { error } = await supabase.storage
        .from('products')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('products').getPublicUrl(filename);

      onSuccess(publicUrl);
      onClose();
      toast({
        title: 'Image Saved!',
        description: 'Studio-quality image added to product.',
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            AI Studio: {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[300px] p-4">
          {step === 'capture' && (
            <div className="space-y-6 text-center w-full">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 bg-muted/5">
                <Camera className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground mb-6">
                  Take a photo of your product. AI will automatically remove the
                  background and add a studio white backdrop.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Snap Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: Place product on a contrasting surface for best results.
              </p>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center space-y-4">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 border-4 border-muted rounded-full" />
                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" />
                <Wand2 className="absolute inset-0 m-auto w-12 h-12 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Magic in progress...</h3>
                <p className="text-sm text-muted-foreground">{loadingText}</p>
              </div>
            </div>
          )}

          {step === 'preview' && processedImage && (
            <div className="space-y-4 w-full">
              <div className="relative aspect-square w-full rounded-lg overflow-hidden border shadow-sm group">
                {/* biome-ignore lint/performance/noImgElement: Dynamic blob URL not suitable for next/image */}
                <img
                  src={processedImage}
                  alt="Processed"
                  className="w-full h-full object-contain bg-white"
                />
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-xs">
                  Studio White
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('capture')}
                  disabled={isUploading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
