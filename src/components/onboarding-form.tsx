
'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, Upload, CheckCircle, Copy } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { getAllBusinessTypes } from '@/config/business-types';
import { saveMerchantData, generateUserId } from '@/services/localMerchantService';

// --- Zod Schema Definitions ---

const baseOnboardingSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  brandPreferences: z.string().optional(),
});

const refinedFormSchema = baseOnboardingSchema.refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
      return false;
    }
    return true;
  }, {
    message: "Please specify your business type with at least 2 characters.",
    path: ["otherBusinessType"],
});

type OnboardingFormValues = z.infer<typeof refinedFormSchema>;

// --- Step Components ---

function StepIndicator({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) {
  const progress = Math.min(((currentStep -1) / (totalSteps -1)) * 100, 100);

  return (
    <div className="flex items-center gap-4" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps} aria-label="Onboarding progress">
      <Progress value={progress} className="w-full" />
      <span className="text-sm text-muted-foreground whitespace-nowrap" aria-live="polite">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

function Step1_BusinessName() {
  const { control } = useFormContext<OnboardingFormValues>();
  return (
    <FormField
      control={control}
      name="businessName"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-lg">What is your business name?</FormLabel>
          <FormControl>
            <Input placeholder="e.g., Amara's Fashion" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function Step2_BusinessType() {
  const { control, watch } = useFormContext<OnboardingFormValues>();
  const businessTypeValue = watch('businessType');
  const businessTypes = useMemo(() => getAllBusinessTypes(), []);

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name="businessType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">What's the nature of your business?</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="e.g., Fashion, Electronics, Art..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {businessTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
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
                <Input placeholder="e.g., Pet Services" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

function Step3_Logo({ onLogoUpdate, onColorsUpdate, brandColors }: { onLogoUpdate: (logo: string | null) => void; onColorsUpdate: (colors: string[] | null) => void; brandColors: string[] | null; }) {
  const form = useFormContext<OnboardingFormValues>();
  const { toast } = useToast();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);
  const [selectedGeneratedLogoIndex, setSelectedGeneratedLogoIndex] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPrompt, setShowColorPrompt] = useState(false);

  const isLoading = isGenerating || isExtracting;
  
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setLogoPreview(dataUri);
        onLogoUpdate(dataUri);
        setGeneratedLogos([]);
        setSelectedGeneratedLogoIndex(null);
        
        setIsExtracting(true);
        try {
          const { businessName, businessType, otherBusinessType } = form.getValues();
          const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;

          const response = await fetch('/api/ai/guide-onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessName, businessType: finalBusinessType, logoDataUri: dataUri, task: 'extract_colors' }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to extract colors.');
          }

          const result = await response.json();
          onColorsUpdate(result.brandColors);
          toast({ title: 'Brand colors extracted!' });

        } catch (e) {
          logger.error({ error: e as Error, message: 'Color extraction failed.' });
          toast({ title: 'Color extraction failed', description: (e as Error).message, variant: 'destructive' });
          onColorsUpdate(null);
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateClick = () => {
    setShowColorPrompt(true);
  };

  const handleGenerateLogos = async () => {
    const isBrandPrefsValid = await form.trigger(['brandPreferences']);
    if (!isBrandPrefsValid) return;

    const { businessName, businessType, brandPreferences, otherBusinessType } = form.getValues();
    
    setIsGenerating(true);
    setGeneratedLogos([]);
    setSelectedGeneratedLogoIndex(null);
    onLogoUpdate(null);
    onColorsUpdate(null);

    try {
      const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;

      const response = await fetch('/api/ai/guide-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessType: finalBusinessType,
          brandPreferences: brandPreferences || '',
          task: 'generate_logos'
        }),
      });

      // No need to check response.ok, as the API now returns 200 even on AI failure.
      // We will check the content of the result instead.
      const result = await response.json();
      
      if (result.error) {
          throw new Error(result.error);
      }
      
      if (!result.logos || result.logos.length === 0) {
        toast({
            title: 'AI Logo Generation Unavailable',
            description: 'To generate logos, please add your Google AI API key to a .env file. See GOOGLE_AI_SETUP.md for instructions.',
            duration: 9000,
        });
      } else {
        setGeneratedLogos(result.logos || []);
        toast({ title: 'Logos generated!', description: 'Please select your favorite.' });
      }

    } catch (e) {
      logger.error({ error: e as Error, message: 'Logo generation failed.' });
      toast({ title: 'Logo generation failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAndContinue = async () => {
    if (selectedGeneratedLogoIndex === null) return;
    
    const selectedLogo = generatedLogos[selectedGeneratedLogoIndex];
    onLogoUpdate(selectedLogo);
    
    setIsExtracting(true);
    try {
      const { businessName, businessType, otherBusinessType } = form.getValues();
      const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;
      
      const response = await fetch('/api/ai/guide-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, businessType: finalBusinessType, logoDataUri: selectedLogo, task: 'extract_colors' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract colors.');
      }

      const result = await response.json();
      onColorsUpdate(result.brandColors);
      toast({ title: 'Logo selected and colors extracted!' });

    } catch (e) {
      logger.error({ error: e as Error, message: 'Color extraction from generated logo failed.' });
      toast({ title: 'Failed to process selected logo', description: (e as Error).message, variant: 'destructive' });
      onColorsUpdate(null);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <FormLabel className="text-lg">Do you have a logo?</FormLabel>
      
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <div className="space-y-2">
            <div className={cn("relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center", {'items-center justify-center': !logoPreview})}>
            {logoPreview ? (
                <Image
                src={logoPreview}
                alt="Uploaded Logo Preview"
                fill
                style={{ objectFit: 'contain' }}
                className="rounded-md p-2"
                />
            ) : (
                <>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
                {isExtracting && <Loader2 className="absolute w-6 h-6 animate-spin text-primary" />}
                </>
            )}
            <Input
                id="logo-upload"
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*"
                onChange={handleLogoUpload}
                aria-label="Upload logo file"
                disabled={isLoading}
            />
            </div>
             {brandColors && brandColors.length > 0 && (
                <div className="flex justify-center gap-2 animate-fade-in pt-2">
                    {brandColors.map((color, index) => (
                    <div
                        key={index}
                        className="h-8 w-full rounded-md border shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                    ))}
                </div>
            )}
        </div>

        <div className="relative flex items-center justify-center md:hidden">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-muted-foreground/30"></div>
          </div>
          <span className="relative bg-background px-2 text-sm text-muted-foreground">or</span>
        </div>

        <div className="flex flex-col items-center justify-center h-48 space-y-4">
          {!showColorPrompt ? (
            <Button type="button" variant="outline" onClick={handleGenerateClick} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
          ) : (
            <div className="w-full space-y-2">
              <FormField
                control={form.control}
                name="brandPreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What's your favorite color?</FormLabel>
                    <Input
                      {...field}
                      placeholder="e.g., 'deep ocean blue'"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={handleGenerateLogos} disabled={isGenerating} className='w-full'>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Logos
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {isGenerating && (
        <div className="text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p>Generating logo options... this can take a moment.</p>
        </div>
      )}

      {generatedLogos.length > 0 && (
        <div className="mt-8 space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold text-center">Choose your favorite logo:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {generatedLogos.map((logo, index) => (
              <div
                key={index}
                onClick={() => !isLoading && setSelectedGeneratedLogoIndex(index)}
                className={cn(
                  "p-2 border-2 rounded-lg cursor-pointer transition-all bg-muted/50 hover:border-primary",
                  selectedGeneratedLogoIndex === index ? 'border-primary' : 'border-transparent'
                )}
              >
                <Image src={logo} alt={`Logo option ${index + 1}`} width={150} height={150} className="w-full h-auto object-contain rounded-md aspect-square" />
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={handleSelectAndContinue}
            disabled={selectedGeneratedLogoIndex === null || isLoading}
            className="w-full"
          >
            {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue with Selected Logo
          </Button>
        </div>
      )}
    </div>
  );
}


function Step4_Success({ businessName }: { businessName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const storeUrl = `${businessName.toLowerCase().replace(/\s+/g, '-')}.baci.store`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://${storeUrl}`);
    toast({
      title: "Copied to clipboard!",
      description: "Your store URL is ready to be shared.",
    });
  };

  return (
    <div className="text-center space-y-4 flex flex-col items-center">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <h3 className="text-2xl font-semibold">Your Store is Ready!</h3>
      <p className="text-muted-foreground">Congratulations! Your new e-commerce store has been created.</p>
      
      <div className="w-full max-w-sm p-4 border rounded-lg bg-muted flex items-center justify-between">
        <span className="font-mono text-sm truncate">https://{storeUrl}</span>
        <Button variant="ghost" size="icon" onClick={copyToClipboard}>
          <Copy className="w-4 h-4" />
        </Button>
      </div>

      <Button onClick={() => router.push('/dashboard')} className="mt-4">
        Go to Dashboard
      </Button>
    </div>
  );
}


function OnboardingNavigation({ currentStep, totalSteps, onNext, onPrev, isLoading }: {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  isLoading: boolean;
}) {

  return (
    <div className="flex justify-between pt-4" role="navigation" aria-label="Onboarding navigation">
      {currentStep > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={isLoading}
          aria-label={`Go to previous step (${currentStep - 1} of ${totalSteps})`}
        >
          Previous
        </Button>
      ) : (
        <div /> // Placeholder to keep "Next" button on the right
      )}
      {currentStep < totalSteps ? (
        <Button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          aria-label={`Go to next step (${currentStep + 1} of ${totalSteps})`}
        >
          Next
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={isLoading}
          aria-label="Submit onboarding form and create store"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Create My Store
        </Button>
      )}
    </div>
  );
}

// --- Main Form Component ---
export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<string[] | null>(null);
  const { toast } = useToast();

  const totalSteps = 3;

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(refinedFormSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      otherBusinessType: '',
      brandPreferences: '',
    },
    mode: 'onBlur',
  });

  const handleNext = async () => {
    let isValid = false;

    // Validate only the fields for the current step
    if (step === 1) {
      isValid = await form.trigger(['businessName']);
    } else if (step === 2) {
      isValid = await form.trigger(['businessType', 'otherBusinessType']);
    } else {
      isValid = await form.trigger();
    }

    if (isValid && step < totalSteps) {
      startTransition(() => {
        setStep(step + 1);
      });
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      startTransition(() => {
        setStep(step - 1);
      });
    }
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsLoading(true);

    try {
      if (!logoDataUri || !brandColors) {
         toast({
          title: 'Missing Information',
          description: 'Please upload or generate a logo and ensure brand colors are selected before creating your store.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const finalBusinessType = data.businessType === 'other'
        ? (data.otherBusinessType || data.businessType)
        : data.businessType;

      generateUserId();
      
      saveMerchantData({
        businessName: data.businessName,
        businessType: finalBusinessType!,
        logo: logoDataUri,
        colors: {
            primary: brandColors[0],
            secondary: brandColors[1],
        }
      });
      
      startTransition(() => {
        setStep(totalSteps + 1); // Move to success step
      });

    } catch (e) {
      logger.error({message: "Onboarding submission failed.", error: e as Error});
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';

      toast({
        title: 'Onboarding Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (step > totalSteps) {
    return <Step4_Success businessName={form.getValues('businessName')} />;
  }

  return (
    <div className="space-y-8">
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
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          aria-label="Store onboarding form"
        >
          <div role="region" aria-live="polite" aria-atomic="true">
            {step === 1 && <Step1_BusinessName />}
            {step === 2 && <Step2_BusinessType />}
            {step === 3 && <Step3_Logo onLogoUpdate={setLogoDataUri} onColorsUpdate={setBrandColors} brandColors={brandColors} />}
          </div>

          <OnboardingNavigation
            currentStep={step}
            totalSteps={totalSteps}
            onNext={handleNext}
            onPrev={handlePrev}
            isLoading={isLoading || isPending}
          />
        </form>
      </FormProvider>
    </div>
  );
}
