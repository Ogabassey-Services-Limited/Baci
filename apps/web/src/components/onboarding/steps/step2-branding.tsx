'use client';

import {
  Eraser,
  Eye,
  LayoutTemplate,
  Loader2,
  Pencil,
  RefreshCw,
  Shuffle,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useShallow } from 'zustand/react/shallow';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import { Button } from '@/components/ui/button';
import { FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { extractBrandColorsFromImage } from '@/lib/extract-brand-colors';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';
import { cn, getContrastColor } from '@/lib/utils';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import { useOnboardingUIStore } from '@/store/onboarding-ui-store';
import type { BrandColors } from '@/types';

// Dynamically import heavy interactive components
const ColorPicker = dynamic(
  () => import('@/components/color-picker').then((mod) => mod.ColorPicker),
  {
    loading: () => <Skeleton className="h-[200px] w-full rounded-md" />,
  }
);

const LogoGeneratorModal = dynamic(
  () =>
    import('@/components/logo-generator-modal').then(
      (mod) => mod.LogoGeneratorModal
    ),
  { ssr: false }
);

export default function Step2_Branding() {
  const form = useFormContext<OnboardingFormValues>();
  const { toast } = useToast();
  const { watch, setValue } = form;

  const businessName = watch('businessName');
  const businessType = watch('businessType');
  const logoUrl = watch('logoUrl'); // Now watching for the uploaded URL
  const brandColorsString = useWatch({
    control: form.control,
    name: 'brandColors',
  });

  let brandColors: BrandColors | null = null;
  if (brandColorsString) {
    try {
      brandColors = JSON.parse(brandColorsString);
    } catch {
      // Invalid JSON, keep null
    }
  }

  const [isGenerating, setIsGenerating] = useState(false); // Tracks AI generation
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for tracking upload
  const [currentLogoDataUri, setCurrentLogoDataUri] = useState<string | null>(
    null
  ); // To store data URI for client-side ops
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

  const isLoading = isGenerating || isExtracting || isUploading;

  // Sync with global UI store for background animations and preview
  const {
    setLogoUploaded,
    setStoreLogoDataUri,
    setShowMobilePreview,
    setShowTemplateSelector,
  } = useOnboardingUIStore(
    useShallow((state) => ({
      setLogoUploaded: state.setLogoUploaded,
      setStoreLogoDataUri: state.setLogoDataUri,
      setShowMobilePreview: state.setShowMobilePreview,
      setShowTemplateSelector: state.setShowTemplateSelector,
    }))
  );

  // Effect to keep currentLogoDataUri updated for client-side operations
  useEffect(() => {
    if (logoUrl?.startsWith('data:')) {
      setCurrentLogoDataUri(logoUrl);
      setStoreLogoDataUri(logoUrl);
    } else if (logoUrl && !currentLogoDataUri) {
      // Fallback for remote URLs if local data URI isn't set (e.g. page refresh)
      setStoreLogoDataUri(logoUrl);
    } else if (!logoUrl) {
      setCurrentLogoDataUri(null);
      setStoreLogoDataUri(null);
    }
  }, [logoUrl, currentLogoDataUri, setStoreLogoDataUri]);

  useEffect(() => {
    setLogoUploaded(!!(currentLogoDataUri || logoUrl));
  }, [currentLogoDataUri, logoUrl, setLogoUploaded]);

  // Unified handler for processing a logo (whether uploaded or generated)
  const processNewLogo = async (
    dataUri: string,
    preserveColors: boolean = false
  ) => {
    setCurrentLogoDataUri(dataUri);
    setStoreLogoDataUri(dataUri);
    setIsExtracting(true);
    setIsUploading(true);

    const uploadPromise = (async () => {
      try {
        const uploadedUrl = await uploadImage(dataUri);
        if (uploadedUrl) {
          setValue('logoUrl', uploadedUrl, { shouldValidate: true });
          // toast({ title: 'Logo saved!' });
        } else {
          throw new Error('Upload failed: No URL returned.');
        }
      } catch (e) {
        logger.error({ error: e as Error, message: 'Logo upload failed.' });
        toast({
          title: 'Upload failed',
          description: (e as Error).message,
          variant: 'destructive',
        });
        // Keep local URI even if upload fails so user can see it
        setValue('logoUrl', dataUri, { shouldValidate: true });
      } finally {
        setIsUploading(false);
      }
    })();

    const extractionPromise = (async () => {
      if (preserveColors) {
        setIsExtracting(false);
        return;
      }
      try {
        const colors = await extractBrandColorsFromImage(dataUri);
        setValue('brandColors', JSON.stringify(colors), {
          shouldValidate: true,
        });
        toast({ title: 'Brand colors extracted!' });
      } catch (e) {
        logger.error({
          error: e as Error,
          message: 'Color extraction failed.',
        });
        // Don't fail hard, let user pick colors manually
        setValue('brandColors', '', { shouldValidate: true });
      } finally {
        setIsExtracting(false);
      }
    })();

    await Promise.all([uploadPromise, extractionPromise]);
  };

  const [progress, setProgress] = useState(0);

  const handleRemoveBackground = async () => {
    const logoToProcess = currentLogoDataUri || logoUrl;
    if (!logoToProcess) return;

    // Check for SVG
    if (
      logoToProcess.includes('image/svg+xml') ||
      logoToProcess.toLowerCase().endsWith('.svg')
    ) {
      toast({
        title: 'Background removal skipped',
        description:
          'SVGs usually have transparent backgrounds already. This tool works best with PNG/JPG images.',
      });
      return;
    }

    setIsUploading(true);
    setProgress(0); // Reset progress

    // Toast is nice, but progress bar is better. removing descriptive toast to rely on UI.

    try {
      // Dynamic import to avoid loading heavy library until needed
      const { removeBackground } = await import('@imgly/background-removal');

      const blob = await removeBackground(logoToProcess, {
        progress: (_key: string, current: number, total: number) => {
          // 'fetch' phase is the download (key.includes('model') or similar)
          // We just calculate overall percent for simplicity
          const percent = Math.round((current / total) * 100);
          setProgress(percent);
        },
      });

      const url = URL.createObjectURL(blob);

      // Convert blob URL to data URI for storage/processing
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        await processNewLogo(dataUri, true);
        URL.revokeObjectURL(url);
        toast({ title: 'Background removed!' });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Background removal failed:', error);
      toast({
        title: 'Background removal failed',
        description: 'Please try a different image.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true); // Immediate feedback

      // Instant preview using Object URL
      const objectUrl = URL.createObjectURL(file);
      setCurrentLogoDataUri(objectUrl);
      setStoreLogoDataUri(objectUrl);

      const reader = new FileReader();

      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        await processNewLogo(dataUri);
        URL.revokeObjectURL(objectUrl); // Cleanup object URL after processing
      };

      reader.onerror = () => {
        setIsUploading(false);
        URL.revokeObjectURL(objectUrl);
        toast({
          title: 'Failed to read file',
          description: 'Please try another image.',
          variant: 'destructive',
        });
      };

      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogo = async (favoriteColor: string) => {
    setIsGeneratorModalOpen(false);
    setIsGenerating(true);
    setValue('brandPreferences', favoriteColor); // Save preference
    toast({
      title: 'Designing your logo...',
      description: 'This usually takes 10-15 seconds.',
    });

    try {
      const result = await guideBusinessOnboarding({
        businessName,
        businessType,
        brandPreferences: favoriteColor,
        task: 'generate_logos',
      });

      if (result.logos && result.logos.length > 0) {
        const generatedLogoUri = result.logos[0];
        const hasGeneratedBrandColors = Boolean(result.brandColors);
        if (result.brandColors) {
          setValue('brandColors', JSON.stringify(result.brandColors), {
            shouldValidate: true,
          });
        }
        await processNewLogo(generatedLogoUri, hasGeneratedBrandColors);
        toast({
          title: 'Logo Generated!',
          description: hasGeneratedBrandColors
            ? "We've applied AI-generated brand colors."
            : 'We extracted colors from your logo where possible. You can fine-tune them below.',
        });
      } else {
        throw new Error('No logo was returned.');
      }
    } catch (error) {
      logger.error({
        error: error as Error,
        message: 'Logo generation failed',
      });
      toast({
        title: 'Generation Failed',
        description: 'Please try again or upload a logo.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleColorChange = (role: keyof BrandColors, newColor: string) => {
    const currentColorsString = form.getValues('brandColors');
    if (currentColorsString) {
      try {
        const currentColors = JSON.parse(currentColorsString);
        const updatedColors = { ...currentColors, [role]: newColor };
        setValue('brandColors', JSON.stringify(updatedColors), {
          shouldValidate: true,
        });
      } catch (e) {
        console.error('Failed to parse brand colors', e);
      }
    }
  };

  const handleShuffleColors = () => {
    if (!brandColors) return;
    const remappedColors: BrandColors = {
      primary: brandColors.accent,
      background: brandColors.primary,
      accent: brandColors.background,
    };
    setValue('brandColors', JSON.stringify(remappedColors), {
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile Action Buttons - Preview Store & Choose Template */}
      {(currentLogoDataUri || logoUrl) && (
        <div className="flex gap-3 w-full lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 text-sm font-medium border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            onClick={() => setShowMobilePreview(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview Store
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 text-sm font-medium border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            onClick={() => setShowTemplateSelector(true)}
          >
            <LayoutTemplate className="mr-2 h-4 w-4" />
            Choose Template
          </Button>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col gap-6 lg:grid lg:gap-8 items-start lg:grid-cols-2'
        )}
      >
        {/* Left Column: Logo Canvas & Palette (Order 2 on Mobile) */}
        <div className="space-y-4 md:space-y-6 w-full order-2 lg:order-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between h-7">
              <FormLabel className="text-lg font-semibold">
                Logo & Brand
              </FormLabel>
              {isGenerating && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  AI is working...
                </span>
              )}
            </div>

            {/* Logo Canvas & Button Wrapper */}
            <div className="max-w-[160px] md:max-w-[224px] mx-auto space-y-2 md:space-y-3">
              {/* Logo Canvas Area */}
              <div
                className={cn(
                  'relative aspect-[3/2] md:aspect-square w-full rounded-xl border border-white/10 overflow-hidden bg-muted/10 flex flex-col items-center justify-center transition-all shadow-inner',
                  currentLogoDataUri || logoUrl
                    ? 'bg-white/5'
                    : 'border-dashed border-muted-foreground/20 hover:bg-muted/20'
                )}
              >
                {currentLogoDataUri || logoUrl ? (
                  <div className="relative w-full h-full p-4 group cursor-pointer">
                    <Image
                      src={currentLogoDataUri || logoUrl}
                      alt="Logo"
                      fill
                      sizes="(max-width: 768px) 160px, 224px"
                      priority
                      unoptimized
                      className="object-contain p-4 transition-all duration-300 group-hover:scale-95 group-hover:opacity-50 group-hover:blur-[1px]"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100 bg-black/60 backdrop-blur-[2px] rounded-xl">
                      <div className="bg-white/10 backdrop-blur-md p-3 rounded-full mb-2 shadow-lg border border-white/20">
                        <RefreshCw className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-white tracking-wide">
                        Replace Logo
                      </span>
                    </div>

                    {/* Hidden Input for Replacement */}
                    <Input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isLoading}
                    />

                    {/* Status Indicators */}
                    {isUploading && (
                      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 z-30">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                        <span className="text-xs text-white font-medium">
                          Saving...
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty State / Upload Trigger */
                  <div className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer group">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-muted/30 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform duration-300">
                      {isGenerating ? (
                        <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-primary" />
                      ) : (
                        <Upload className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      {isGenerating
                        ? 'Generating Logo...'
                        : 'Click to Upload Image'}
                    </p>
                    <Input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>

              {/* Remove Background Button */}
              {(currentLogoDataUri || logoUrl) && (
                <Button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={isUploading}
                  variant="outline"
                  className="w-full border-dashed border-2 hover:border-solid hover:bg-muted/50"
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eraser className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? 'Processing...' : 'Remove Background'}
                </Button>
              )}

              {/* Progress Bar for AI Model Download */}
              {isUploading && progress > 0 && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Downloading AI Model...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Generator Controls (Order 1 on Mobile) */}
        <div className="mx-auto space-y-2 md:space-y-3 w-full order-1 lg:order-2">
          {currentLogoDataUri || logoUrl ? (
            <>
              <div className="flex items-center justify-center gap-2 text-blue-400 mb-2">
                <Wand2 className="w-4 h-4" />
                <h3 className="font-semibold text-sm text-foreground">
                  Customise Colours
                </h3>
              </div>

              {/* Generator Control Card */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 dark:from-white/5 dark:to-transparent border border-white/10 rounded-xl pt-8 pb-10 px-6 md:p-6 flex flex-col items-center justify-center gap-0 md:gap-3 shadow-sm w-full max-w-full h-auto min-h-[160px] md:min-h-0 md:aspect-auto">
                <div className="text-center space-y-1 hidden md:block">
                  <p className="text-sm text-muted-foreground leading-relaxed text-balance">
                    Customize your brand colors to match your style.
                  </p>
                </div>

                {brandColors && (
                  <div className="animate-in slide-in-from-top-2 fade-in duration-500 space-y-4 w-full">
                    <div className="flex items-center justify-center gap-3">
                      {(['primary', 'background', 'accent'] as const).map(
                        (role) => (
                          <div
                            key={role}
                            className="flex flex-col items-center gap-1.5 group"
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="w-10 h-10 rounded-full shadow-sm border-2 border-white/10 ring-2 ring-transparent hover:ring-primary/20 transition-all cursor-pointer relative overflow-hidden"
                                  aria-label={`Edit ${role} color`}
                                >
                                  <div
                                    className="w-full h-full"
                                    style={{
                                      backgroundColor: brandColors[role],
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Pencil
                                      className={cn(
                                        'w-3.5 h-3.5 drop-shadow-md',
                                        getContrastColor(brandColors[role]) ===
                                          'black'
                                          ? 'text-black'
                                          : 'text-white'
                                      )}
                                    />
                                  </div>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 border-none shadow-xl">
                                <ColorPicker
                                  color={brandColors[role]}
                                  onChange={(newColor) =>
                                    handleColorChange(role, newColor)
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                            <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">
                              {role}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Shuffle Button - Moved Outside */}
              <Button
                type="button"
                onClick={handleShuffleColors}
                disabled={isLoading}
                variant="outline"
                className="hidden md:flex w-full border-dashed border-2 hover:border-solid hover:bg-muted/50"
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Shuffle Colors
              </Button>
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-2 text-amber-400 h-7">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold text-lg text-foreground pt-1">
                  Need a Logo?
                </h3>
              </div>

              {/* Generator Control Card - Compact on Mobile */}
              <div className="bg-transparent md:bg-gradient-to-br md:from-white/5 md:to-white/0 md:dark:from-white/5 md:dark:to-transparent border-0 md:border md:border-white/10 rounded-xl p-0 md:p-5 flex flex-col gap-3 md:gap-4 shadow-none md:shadow-sm h-auto md:h-full md:min-h-[200px]">
                <div className="text-left space-y-4 hidden md:block">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Don't have a logo yet? No problem. Our AI can design a
                    unique, minimalist logo tailored to{' '}
                    <strong>{businessName}</strong> in seconds.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                    <li>Instant generation</li>
                    <li>Auto-extracted brand colors</li>
                    <li>Professional vector style</li>
                  </ul>
                </div>

                <div className="w-full">
                  <div className="flex md:hidden items-center gap-2 mb-2 text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Or create one
                    </span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  <LogoGeneratorModal
                    isOpen={isGeneratorModalOpen}
                    onOpenChange={setIsGeneratorModalOpen}
                    onGenerate={handleGenerateLogo}
                    isGenerating={isGenerating}
                  >
                    <Button
                      type="button"
                      disabled={isLoading}
                      className="w-full bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-600 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 font-medium mt-auto shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate with AI
                    </Button>
                  </LogoGeneratorModal>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Messages for Hidden Fields */}
      <div className="space-y-2">
        {form.formState.errors?.logoUrl && (
          <p className="text-[0.8rem] font-medium text-destructive">
            {form.formState.errors.logoUrl.message}
          </p>
        )}
        {form.formState.errors?.brandColors && (
          <p className="text-[0.8rem] font-medium text-destructive">
            {form.formState.errors.brandColors.message}
          </p>
        )}
      </div>
    </div>
  );
}
