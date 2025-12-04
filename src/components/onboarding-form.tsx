'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Data } from '@measured/puck';
import type { User } from '@supabase/supabase-js';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import ColorThief from 'colorthief';
import {
  AlertCircle,
  CheckCircle,
  Eraser,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Shuffle,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import {
  type ServerActionState,
  sendMagicLink,
  submitOnboarding,
} from '@/app/onboarding/actions';
import {
  trackMerchantSignupCompleted,
  trackMerchantSignupStarted,
} from '@/components/analytics/platform-analytics-provider';
import { BusinessNameGeneratorModal } from '@/components/business-name-generator-modal';
import { Logo } from '@/components/logo';
import { LogoGeneratorModal } from '@/components/logo-generator-modal';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TypingPlaceholderInput } from '@/components/ui/typing-placeholder-input';
import { getAllBusinessTypes } from '@/config/business-types';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { checkPasswordStrength, cn, getContrastColor } from '@/lib/utils';
import {
  type OnboardingFormValues,
  onboardingSchema,
  step3Schema,
} from '@/schemas/onboarding';
import { useOnboardingUIStore } from '@/store/onboarding-ui-store';
import type { BrandColors } from '@/types';
import { ColorPicker } from './color-picker';
import { OnboardingPuckPreview } from './onboarding-puck-preview';
import { OnboardingTemplateEditor } from './onboarding-template-editor';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

extend([a11yPlugin]);

// --- Step Components ---

const premiumInputClass =
  'bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all shadow-sm';

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  // Calculate progress with a minimum of 15% for step 1 to show visual feedback
  const baseProgress = ((currentStep - 1) / (totalSteps - 1)) * 100;
  const progress = currentStep === 1 ? 15 : baseProgress;
  return (
    <div className="flex items-center gap-4">
      <Progress
        value={progress}
        className="w-full"
        aria-label="Onboarding progress"
      />
      <span
        className="text-sm text-muted-foreground whitespace-nowrap"
        aria-live="polite"
      >
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

function Step1_BusinessDetails({
  onKeyDown,
}: {
  onKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>
  ) => void;
}) {
  const { control, watch, setValue } = useFormContext<OnboardingFormValues>();
  const businessTypeValue = watch('businessType');
  const businessTypes = useMemo(() => getAllBusinessTypes(), []);

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="businessType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">
              What's the nature of your business?
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              name="businessType"
            >
              <FormControl>
                <SelectTrigger
                  onKeyDown={onKeyDown}
                  className={cn(
                    premiumInputClass,
                    !field.value && 'text-muted-foreground'
                  )}
                >
                  <SelectValue placeholder="e.g., Fashion, Electronics, Art..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {businessTypes.map((type) => {
                  // Emoji mapping for business types
                  const emojiMap: Record<string, string> = {
                    fashion: '👗',
                    electronics: '💻',
                    'home-goods': '🏠',
                    'health-beauty': '💄',
                    handmade: '🎨',
                    'food-beverage': '🍔',
                    'hair-extensions': '💇‍♀️',
                  };
                  const emoji = emojiMap[type.id] || '🏢';

                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <span className="text-primary">{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {businessTypeValue === 'other' && (
        <FormField
          control={control}
          name="otherBusinessType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Please specify</FormLabel>
              <FormControl>
                <TypingPlaceholderInput
                  staticPrefix="e.g., "
                  placeholders={[
                    'Pet Services',
                    'Consulting',
                    'Event Planning',
                    'Tutoring',
                  ]}
                  {...field}
                  onKeyDown={onKeyDown}
                  name="otherBusinessType"
                  autoComplete="organization"
                  className={premiumInputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="businessName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">
              What is your business name?
            </FormLabel>
            <FormControl>
              <TypingPlaceholderInput
                staticPrefix="e.g., "
                placeholders={[
                  "Amara's Fashion",
                  'Tech Haven',
                  'The Coffee Spot',
                  'Green Grocer',
                  'Urban Styles',
                ]}
                {...field}
                onChange={(e) => {
                  // Convert to sentence case (title case)
                  const words = e.target.value.split(' ');
                  const titleCased = words
                    .map((word) => {
                      if (word.length === 0) return word;
                      return (
                        word.charAt(0).toUpperCase() +
                        word.slice(1).toLowerCase()
                      );
                    })
                    .join(' ');
                  field.onChange(titleCased);
                }}
                onKeyDown={onKeyDown}
                name="businessName"
                autoComplete="organization"
                className={premiumInputClass}
              />
            </FormControl>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="group h-auto p-0 text-[13px] font-semibold text-primary hover:bg-transparent transition-all duration-300"
              onClick={() => setIsGeneratorOpen(true)}
            >
              <Sparkles className="w-3.5 h-3.5 mr-0.5 text-amber-500 group-hover:text-amber-600 transition-colors" />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary/90 group-hover:to-primary/60">
                Generate Business Name
              </span>
            </Button>
            <FormMessage />
          </FormItem>
        )}
      />
      <BusinessNameGeneratorModal
        isOpen={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onNameSelect={(name) => {
          setValue('businessName', name, { shouldValidate: true });
        }}
        businessType={businessTypeValue}
      />
    </div>
  );
}

function Step2_Branding() {
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

  const brandColors: BrandColors | null = useMemo(() => {
    if (!brandColorsString) return null;
    try {
      return JSON.parse(brandColorsString);
    } catch {
      return null;
    }
  }, [brandColorsString]);

  const [isGenerating, setIsGenerating] = useState(false); // Tracks AI generation
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for tracking upload
  const [currentLogoDataUri, setCurrentLogoDataUri] = useState<string | null>(
    null
  ); // To store data URI for client-side ops
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

  const isLoading = isGenerating || isExtracting || isUploading;

  // Sync with global UI store for background animations and preview
  const setLogoUploaded = useOnboardingUIStore(
    (state) => state.setLogoUploaded
  );
  const setStoreLogoDataUri = useOnboardingUIStore(
    (state) => state.setLogoDataUri
  );

  // Effect to keep currentLogoDataUri updated for client-side operations
  useEffect(() => {
    if (logoUrl?.startsWith('data:')) {
      setCurrentLogoDataUri(logoUrl);
      setStoreLogoDataUri(logoUrl);
    } else if (logoUrl && !currentLogoDataUri) {
      // Fallback for remote URLs if local data URI isn't set (e.g. page refresh)
      // We don't fetch remote here to avoid CORS/bandwidth, just rely on img tags handling it
      setStoreLogoDataUri(logoUrl);
    } else if (!logoUrl) {
      setCurrentLogoDataUri(null);
      setStoreLogoDataUri(null);
    }
  }, [logoUrl, currentLogoDataUri, setStoreLogoDataUri]);

  useEffect(() => {
    setLogoUploaded(!!(currentLogoDataUri || logoUrl));
  }, [currentLogoDataUri, logoUrl, setLogoUploaded]);

  const extractColorsFromImage = (
    imageDataUri: string
  ): Promise<BrandColors> => {
    return new Promise((resolve, reject) => {
      const colorThief = new ColorThief();
      const img = document.createElement('img');
      img.src = imageDataUri;
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          const palette = colorThief.getPalette(img, 8); // Get more colors to filter from
          const toHex = (rgb: number[]) =>
            `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

          // Helper: Check if color is too neutral (white/black/gray)
          const isNeutral = (rgb: number[]) => {
            const [r, g, b] = rgb;
            const brightness = (r + g + b) / 3;
            const maxDiff = Math.max(
              Math.abs(r - g),
              Math.abs(g - b),
              Math.abs(r - b)
            );

            // Too bright (near white) or too dark (near black) or low color variance (gray)
            return brightness > 240 || brightness < 20 || maxDiff < 15;
          };

          // Helper: Calculate saturation (how "colorful" the color is)
          const getSaturation = (rgb: number[]) => {
            const [r, g, b] = rgb;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            return max === 0 ? 0 : delta / max;
          };

          // Filter out neutral colors
          const vibrantColors = palette.filter((color) => !isNeutral(color));

          // Sort by saturation (most colorful first)
          vibrantColors.sort((a, b) => getSaturation(b) - getSaturation(a));

          // Pick primary and accent from vibrant colors, or fallback to original palette
          const primaryRgb = vibrantColors[0] || palette[0] || [0, 0, 0];
          const accentRgb = vibrantColors[1] || palette[1] || primaryRgb;

          resolve({
            primary: toHex(primaryRgb),
            background: '#FFFFFF',
            accent: toHex(accentRgb),
          });
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = (_e) => {
        reject(new Error('Image could not be loaded for color extraction.'));
      };
    });
  };

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
        const colors = await extractColorsFromImage(dataUri);
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

  const handleRemoveBackground = async () => {
    const logoToProcess = currentLogoDataUri || logoUrl;
    if (!logoToProcess) return;

    setIsUploading(true);
    toast({
      title: 'Removing background...',
      description: 'This happens locally on your device.',
    });

    try {
      // Dynamic import to avoid loading heavy library until needed
      const { removeBackground } = await import('@imgly/background-removal');

      const blob = await removeBackground(logoToProcess);
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
      setIsUploading(false);
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
        await processNewLogo(generatedLogoUri);
        toast({
          title: 'Logo Generated!',
          description: "We've also extracted your brand colors.",
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
    <div className="space-y-8">
      <div className={cn('grid gap-8', 'grid-cols-1 lg:grid-cols-2')}>
        {/* Left Column: Logo Canvas & Palette */}
        <div className="space-y-6">
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
            <div className="max-w-[224px] mx-auto space-y-3">
              {/* Logo Canvas Area */}
              <div
                className={cn(
                  'relative aspect-square w-full rounded-xl border border-white/10 overflow-hidden bg-muted/10 flex flex-col items-center justify-center transition-all shadow-inner',
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
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      {isGenerating ? (
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
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
            </div>
          </div>
        </div>

        {/* Right Column: Generator Controls */}
        <div className="space-y-6 mt-12">
          {currentLogoDataUri || logoUrl ? (
            <>
              <div className="flex items-center gap-2 text-blue-400 h-7">
                <Wand2 className="w-5 h-5" />
                <h3 className="font-semibold text-lg text-foreground pt-4">
                  Refine Logo
                </h3>
              </div>

              {/* Generator Control Card */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 dark:from-white/5 dark:to-transparent border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-sm h-full min-h-[200px]">
                <div className="text-left space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Make the Logo pop by removing the background.
                  </p>
                </div>

                {brandColors && (
                  <div className="mt-4 pt-2 border-t border-white/10 animate-in slide-in-from-top-2 fade-in duration-500 space-y-3 -mt-2">
                    <div className="flex items-center justify-center gap-4 px-2">
                      {(['primary', 'background', 'accent'] as const).map(
                        (role) => (
                          <div
                            key={role}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="w-12 h-12 rounded-full shadow-sm border-2 border-white/10 ring-2 ring-transparent hover:ring-primary/20 transition-all cursor-pointer relative overflow-hidden"
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
                                        'w-4 h-4 drop-shadow-md',
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
                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                              {role}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleShuffleColors}
                        disabled={isLoading}
                        className="flex-1 h-9 text-xs"
                      >
                        <Shuffle className="mr-1.5 h-3 w-3" />
                        Shuffle
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-amber-400 h-7">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold text-lg text-foreground pt-1">
                  Need a Logo?
                </h3>
              </div>

              {/* Generator Control Card */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 dark:from-white/5 dark:to-transparent border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-sm h-full min-h-[200px]">
                <div className="text-left space-y-4">
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
                <LogoGeneratorModal
                  isOpen={isGeneratorModalOpen}
                  onOpenChange={setIsGeneratorModalOpen}
                  onGenerate={handleGenerateLogo}
                  isGenerating={isGenerating}
                >
                  <Button
                    type="button"
                    disabled={isLoading}
                    className="w-full bg-white text-black hover:bg-gray-200 dark:bg-white dark:text-black font-medium mt-auto border border-primary/10 shadow-sm"
                  >
                    Generate with AI
                  </Button>
                </LogoGeneratorModal>
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

// ... (Step3_Account, OnboardingNavigation, OnboardingForm)
function Step3_Account({
  onKeyDown,
  onMagicLinkSent,
  user,
}: {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onMagicLinkSent: () => void;
  user: User | null;
}) {
  const form = useFormContext<OnboardingFormValues>();
  const { control, watch } = form;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [magicLinkSubmitting, setMagicLinkSubmitting] =
    useState<boolean>(false);
  const { toast } = useToast();

  const password = watch('password') || '';
  const passwordStrength = checkPasswordStrength(password);
  const isPasswordStrong = passwordStrength >= 3;

  const handleMagicLinkRequest = async () => {
    const { email } = form.getValues();
    const isEmailValid = await form.trigger('email');
    if (!isEmailValid) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }

    setMagicLinkSubmitting(true);
    const result = await sendMagicLink(email);
    setMagicLinkSubmitting(false);

    if (result.success) {
      onMagicLinkSent();
    } else {
      toast({
        title: 'Failed to send magic link',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {user ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Logged In</AlertTitle>
          <AlertDescription>
            You are logged in as <strong>{user.email}</strong>. Click "Create My
            Store" below to continue.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <FormField
            control={control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                      value={field.value || ''}
                      onKeyDown={onKeyDown}
                      className="pl-10"
                      name="email"
                      autoComplete="email"
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleMagicLinkRequest}
            disabled={magicLinkSubmitting}
          >
            {magicLinkSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
            )}
            {magicLinkSubmitting
              ? 'Sending Magic Link...'
              : 'Continue with Magic Link'}
          </Button>

          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              OR CREATE PASSWORD
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <FormField
            control={control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      {...field}
                      value={field.value || ''}
                      onKeyDown={onKeyDown}
                      className="pl-10 pr-10"
                      name="password"
                      autoComplete="new-password"
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="off"
                      data-form-type="password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <PasswordStrengthIndicator strength={passwordStrength} />
                <FormMessage />
              </FormItem>
            )}
          />

          {isPasswordStrong && (
            <FormField
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="animate-fade-in">
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        {...field}
                        value={field.value || ''}
                        onKeyDown={onKeyDown}
                        className="pl-10 pr-10"
                        name="confirmPassword"
                        autoComplete="new-password"
                        spellCheck="false"
                        autoCorrect="off"
                        autoCapitalize="off"
                        data-form-type="password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      )}
    </div>
  );
}

function OnboardingNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  isLoading,
  isStepValid,
}: {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  isLoading: boolean;
  isStepValid: boolean;
}) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex justify-between pt-4">
      {currentStep > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={isLoading}
        >
          Previous
        </Button>
      ) : (
        <div />
      )}
      {isLastStep ? (
        <Button
          type="submit"
          disabled={isLoading || !isStepValid}
          id="submit-button"
        >
          {isLoading && (
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
          )}{' '}
          Create My Store
        </Button>
      ) : (
        <Button type="button" onClick={onNext} disabled={isLoading}>
          Next
        </Button>
      )}
    </div>
  );
}

// --- Main Form Component ---
export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [submissionState, formAction, isPending] = useActionState<
    ServerActionState,
    FormData
  >(submitOnboarding, { message: '', success: false });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [user, setUser] = useState<User | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [templateData, setTemplateData] = useState<Data | null>(null);

  // Subscribe to global store for immediate logo preview
  const storeLogoDataUri = useOnboardingUIStore((state) => state.logoDataUri);
  const { toast } = useToast();
  const _router = useRouter();
  const totalSteps = 3;
  const searchParams = useSearchParams();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldUnregister: false,
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      businessName: '',
      businessType: '',
      otherBusinessType: '',
      brandPreferences: '',
      logoUrl: '',
      brandColors: '',
    },
  });

  const {
    formState: { errors },
  } = form;

  useEffect(() => {
    // Check for existing session
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        form.setValue('email', session.user.email || '');
      }
    });

    const fromMagicLink = searchParams.get('fromMagicLink');
    if (fromMagicLink) {
      const savedData = localStorage.getItem('onboardingForm');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        form.reset(parsedData.values);
        form.setValue('logoUrl', parsedData.logoDataUri);
        form.setValue('brandColors', parsedData.brandColors);
        // Defer state update to avoid cascading renders
        queueMicrotask(() => {
          setStep(3);
          toast({
            title: 'Welcome back!',
            description:
              "You are now logged in. Please click 'Create My Store' to finish.",
            duration: 5000,
          });
        });
      }
    }
  }, [searchParams, form, toast]);

  useEffect(() => {
    if (submissionState.success) {
      localStorage.removeItem('onboardingForm');
      toast({
        title: 'Store Created!',
        description:
          'Your e-commerce store is ready. Redirecting you to the dashboard...',
      });

      // Track merchant signup completed for platform analytics
      if (submissionState.merchantId) {
        trackMerchantSignupCompleted(submissionState.merchantId, {
          business_name: submissionState.businessName,
        });
      }

      // Refresh the client session to sync with server-side auth, then redirect
      // Add a small delay to ensure the merchant record is fully committed
      const supabase = createClient();

      // Wait for session and verify merchant exists before redirecting
      const verifyAndRedirect = async () => {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        console.log('Session check after signup:', {
          hasSession: !!session,
          error,
        });

        if (!session) {
          console.error('No session found after signup!', error);
          toast({
            title: 'Session Error',
            description: 'Please try logging in manually',
            variant: 'destructive',
          });
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }

        // Verify merchant record exists before redirecting
        const { data: merchant, error: merchantError } = await supabase
          .from('merchants')
          .select('id, business_name')
          .eq('user_id', session.user.id)
          .single();

        if (merchant?.business_name) {
          console.log(
            'Session and merchant verified, redirecting to dashboard'
          );
          window.location.href = '/dashboard';
        } else {
          console.error(
            'Merchant record not found after signup:',
            merchantError
          );
          // Retry after a short delay - database might need time to replicate
          setTimeout(async () => {
            const { data: retryMerchant } = await supabase
              .from('merchants')
              .select('id, business_name')
              .eq('user_id', session.user.id)
              .single();

            if (retryMerchant?.business_name) {
              window.location.href = '/dashboard';
            } else {
              toast({
                title: 'Setup Issue',
                description:
                  'Your store was created but there was an issue loading it. Please try logging in.',
                variant: 'destructive',
              });
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
            }
          }, 1500);
        }
      };

      verifyAndRedirect();
    } else if (submissionState.message) {
      const fieldErrors = submissionState.errors?.fieldErrors;
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([fieldName, messages]) => {
          if (messages?.length) {
            form.setError(fieldName as keyof OnboardingFormValues, {
              type: 'server',
              message: messages.join(', '),
            });
          }
        });
      }
      if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
        toast({
          title: 'An error occurred',
          description: submissionState.message,
          variant: 'destructive',
        });
      }
    }
  }, [submissionState, form, toast]);

  const handleNext = async () => {
    let isValidStep = false;
    if (step === 1) {
      isValidStep = await form.trigger([
        'businessName',
        'businessType',
        'otherBusinessType',
      ]);
    } else if (step === 2) {
      isValidStep = await form.trigger(['logoUrl', 'brandColors']);
      if (!isValidStep) {
        toast({
          title: 'Branding Incomplete',
          description: 'Please upload a logo to extract brand colors.',
          variant: 'destructive',
        });
      }
    }

    if (isValidStep) {
      // Track signup started when entering final step (step 3)
      if (step === 2) {
        const values = form.getValues();
        trackMerchantSignupStarted({
          business_name: values.businessName,
          business_type: values.businessType,
        });
      }
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step < totalSteps) {
        await handleNext();
      } else {
        document.getElementById('submit-button')?.click();
      }
    }
  };

  const handleMagicLinkSent = () => {
    const values = form.getValues();
    const dataToSave = {
      values: {
        businessName: values.businessName,
        businessType: values.businessType,
        otherBusinessType: values.otherBusinessType,
        brandPreferences: values.brandPreferences,
        email: values.email,
      },
      logoDataUri: values.logoUrl,
      brandColors: values.brandColors,
    };
    localStorage.setItem('onboardingForm', JSON.stringify(dataToSave));
    setMagicLinkSent(true);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const values = form.getValues();
    // logoUrl should already be uploaded by Step2_Branding
    const logoUrl = values.logoUrl;

    const formData = new FormData();
    formData.append('email', values.email || '');
    formData.append('password', values.password || '');
    formData.append('confirmPassword', values.confirmPassword || '');
    formData.append('businessName', values.businessName || '');
    formData.append('businessType', values.businessType || '');
    formData.append('otherBusinessType', values.otherBusinessType || '');
    formData.append('brandPreferences', values.brandPreferences || '');
    formData.append('logoUrl', logoUrl || '');
    formData.append('brandColors', values.brandColors || '');

    startTransition(() => {
      formAction(formData);
    });
  };

  const formEmail = useWatch({ control: form.control, name: 'email' });
  const formPassword = useWatch({ control: form.control, name: 'password' });
  const formConfirmPassword = useWatch({
    control: form.control,
    name: 'confirmPassword',
  });

  // Watch fields for Preview
  const brandColors = useWatch({ control: form.control, name: 'brandColors' });
  const businessName = useWatch({
    control: form.control,
    name: 'businessName',
  });
  const businessType = useWatch({
    control: form.control,
    name: 'businessType',
  });
  const logoUrl = useWatch({ control: form.control, name: 'logoUrl' });

  // Memoize parsed brandColors to prevent infinite re-renders in preview
  const parsedBrandColors = useMemo(() => {
    if (!brandColors) return undefined;
    try {
      return JSON.parse(brandColors) as BrandColors;
    } catch {
      return undefined;
    }
  }, [brandColors]);

  const showPreview = step === 2 && !!brandColors;

  const isStep3Valid = useMemo(() => {
    if (step !== 3) return true;
    if (user) return true; // Skip validation if user is logged in
    const validationData = {
      email: formEmail,
      password: formPassword,
      confirmPassword: formConfirmPassword,
    };
    const result = step3Schema.safeParse(validationData);
    return result.success;
  }, [formEmail, formPassword, formConfirmPassword, step, user]);

  const isCurrentStepValid = useMemo(() => {
    if (step === 1)
      return (
        !errors.businessName &&
        !errors.businessType &&
        !errors.otherBusinessType
      );
    if (step === 2) return !errors.logoUrl && !errors.brandColors; // Updated to logoUrl
    if (step === 3) return isStep3Valid;
    return false;
  }, [step, errors, isStep3Valid]);

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-in-out w-full',
        showPreview
          ? 'max-w-[90rem] px-4 md:px-8 h-[calc(100vh-1rem)] flex items-center justify-center'
          : 'max-w-2xl mx-auto px-4 py-8'
      )}
    >
      <div
        className={cn('flex flex-col lg:flex-row gap-8 items-center w-full')}
      >
        {/* Main Card */}
        <div
          className={cn(
            'relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl transition-all duration-500',
            showPreview
              ? 'w-full lg:w-1/2 xl:w-[45%] h-[550px] overflow-hidden'
              : 'w-full'
          )}
        >
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

          <div
            className={cn(
              'relative transition-all duration-500',
              showPreview
                ? 'p-6 h-full flex flex-col justify-center scale-[0.85] origin-center'
                : 'p-8'
            )}
          >
            <div className="flex flex-col items-center text-center mb-6 mt-4">
              <Link
                href="/"
                className="mb-4 transition-transform hover:scale-105"
              >
                <Logo />
              </Link>
            </div>

            <div className="space-y-4">
              <header>
                <h2 className="text-2xl font-bold text-center font-headline">
                  Welcome to Baci
                </h2>
                <p className="text-muted-foreground text-center">
                  Let's set up your store in a few simple steps.
                </p>
              </header>
              <StepIndicator currentStep={step} totalSteps={totalSteps} />
              <FormProvider {...form}>
                <form
                  onSubmit={handleFormSubmit}
                  aria-label="Store onboarding form"
                  noValidate
                >
                  <input type="hidden" {...form.register('logoUrl')} />
                  <input type="hidden" {...form.register('brandColors')} />
                  <section
                    aria-live="polite"
                    aria-atomic="true"
                    className="min-h-[250px]"
                  >
                    {step === 1 && (
                      <Step1_BusinessDetails onKeyDown={handleKeyDown} />
                    )}
                    {step === 2 && <Step2_Branding />}
                    {step === 3 &&
                      (magicLinkSent ? (
                        <Alert className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Magic Link Sent!</AlertTitle>
                          <AlertDescription>
                            Please check your email for a link to sign in. You
                            can close this window.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Step3_Account
                          onKeyDown={handleKeyDown}
                          onMagicLinkSent={handleMagicLinkSent}
                          user={user}
                        />
                      ))}
                  </section>
                  <OnboardingNavigation
                    currentStep={step}
                    totalSteps={totalSteps}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    isLoading={isPending || isSubmitting}
                    isStepValid={isCurrentStepValid}
                  />
                </form>
              </FormProvider>
            </div>
          </div>
        </div>

        {/* Preview Pane (Outside) */}
        {/* Preview Pane (Outside) */}
        {showPreview && (
          <div
            className={cn(
              'transition-all duration-500 ease-in-out',
              isPreviewExpanded
                ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-xl p-8 flex items-center justify-center'
                : 'hidden lg:block w-full lg:w-1/2 xl:w-[50%] flex items-center justify-center animate-in fade-in slide-in-from-right-8 duration-700'
            )}
          >
            <div
              className={cn(
                'relative rounded-3xl border border-white/10 bg-muted/5 overflow-y-auto shadow-2xl backdrop-blur-sm transition-all duration-500 scrollbar-visible',
                isPreviewExpanded ? 'w-[90vw] h-[90vh]' : 'w-full h-[500px]'
              )}
              style={{
                scrollbarWidth: 'auto',
                scrollbarColor: 'var(--primary) rgba(255,255,255,0.1)',
              }}
            >
              {/* Expand/Collapse Button */}
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-4 right-4 z-50 rounded-full shadow-lg border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background"
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              >
                {isPreviewExpanded ? (
                  <>
                    <Minimize2 className="mr-2 h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Expand
                  </>
                )}
              </Button>

              <OnboardingPuckPreview
                businessName={businessName}
                businessType={businessType}
                logoDataUri={storeLogoDataUri || logoUrl || undefined}
                brandColors={parsedBrandColors}
                onEdit={(data) => {
                  setTemplateData(data);
                  setIsEditorOpen(true);
                }}
                data={templateData}
              />
            </div>
          </div>
        )}

        {/* Full Screen Template Editor */}
        {isEditorOpen && templateData && (
          <OnboardingTemplateEditor
            initialData={templateData}
            brandColors={parsedBrandColors || null}
            onSave={(data) => {
              setTemplateData(data);
              setIsEditorOpen(false);
            }}
            onClose={() => setIsEditorOpen(false)}
            businessName={businessName}
          />
        )}
      </div>
    </div>
  );
}
