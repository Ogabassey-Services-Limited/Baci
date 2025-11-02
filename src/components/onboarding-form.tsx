
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
import type { BrandColors } from '@/ai/flows/guide-business-onboarding';
import { createClient } from '@/lib/supabase/client';

// --- Zod Schema Definitions ---

const baseOnboardingSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
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

interface BrandColors {
    primary: string;
    secondary: string;
    accent: string;
}

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
    <div className="space-y-4">
      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">Your Email</FormLabel>
            <FormControl>
              <Input type="email" placeholder="your@email.com" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">Create a Password</FormLabel>
            <FormControl>
              <Input type="password" placeholder="Min. 8 characters" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
    </div>
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

function Step3_Logo({ onLogoUpdate, onColorsUpdate, brandColors }: { onLogoUpdate: (logo: string | null) => void; onColorsUpdate: (colors: BrandColors | null) => void; brandColors: BrandColors | null; }) {
  const form = useFormContext<OnboardingFormValues>();
  const { toast } = useToast();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);
  const [selectedGeneratedLogoIndex, setSelectedGeneratedLogoIndex] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPrompt, setShowColorPrompt] = useState(false);

  const isLoading = isGenerating || isExtracting;

  // Extract colors from image using Web Worker + colorthief (non-blocking, accurate)
  const extractColorsFromImage = (imageDataUri: string): Promise<BrandColors> => {
    return new Promise((resolve, reject) => {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        reject(new Error('Web Workers not supported in this browser'));
        return;
      }

      try {
        // Create a new worker instance
        const worker = new Worker('/color-worker.js');

        // Set up timeout to prevent hanging
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Color extraction timed out'));
        }, 10000); // 10 second timeout

        // Listen for messages from the worker
        worker.onmessage = (event) => {
          clearTimeout(timeout);
          worker.terminate();

          const { success, colors, error } = event.data;

          if (success && colors) {
            console.log('✅ Colors extracted via Web Worker:', colors);
            resolve(colors);
          } else {
            console.error('❌ Worker failed:', error);
            reject(new Error(error || 'Color extraction failed'));
          }
        };

        // Handle worker errors
        worker.onerror = (error) => {
          clearTimeout(timeout);
          worker.terminate();
          console.error('❌ Worker error:', error);
          reject(new Error('Worker error: ' + error.message));
        };

        // Send the image data to the worker
        worker.postMessage({ imageDataUri });

      } catch (error) {
        console.error('❌ Failed to create worker:', error);
        reject(error);
      }
    });
  };

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
          console.log('🎨 Extracting colors from uploaded logo using client-side analysis...');
          const colors = await extractColorsFromImage(dataUri);
          console.log('✅ Colors extracted:', colors);

          onColorsUpdate(colors);
          toast({ title: 'Brand colors extracted!', description: 'Colors extracted from your logo.' });

        } catch (e) {
          console.error('❌ Color extraction error:', e);
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
  
    const colorEntries = brandColors ? Object.entries(brandColors) : [];


  return (
    <div className='space-y-4'>
      <FormLabel className="text-lg">Do you have a logo?</FormLabel>
      
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <div className="space-y-2">
            <div className={cn("relative border-2 border-dashed rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center transition-colors",
                logoPreview ? 'border-green-500 bg-green-50/50' : 'border-muted-foreground/50'
            )}>
            {logoPreview ? (
                <>
                <Image
                    src={logoPreview}
                    alt="Uploaded Logo Preview"
                    fill
                    style={{ objectFit: 'contain' }}
                    className="rounded-md p-2"
                />
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md">
                    <CheckCircle className="w-4 h-4 text-white" />
                </div>
                </>
            ) : (
                <>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
                </>
            )}
             {isExtracting && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
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
            {brandColors && (
                <div className="pt-2 animate-fade-in space-y-2">
                    <div className="flex items-center gap-2 justify-center">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <p className="text-sm font-medium">Brand Colors Extracted</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {colorEntries.map(([key, color]) => (
                            <div key={key} className="space-y-1 text-center">
                                <div
                                    className="h-10 w-full rounded-md border-2 border-border shadow-sm"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                                <p className="text-[10px] font-medium text-muted-foreground capitalize">{key}</p>
                            </div>
                        ))}
                    </div>
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
  const [brandColors, setBrandColors] = useState<BrandColors | null>(null);
  const { toast } = useToast();

  const totalSteps = 3;

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(refinedFormSchema),
    defaultValues: {
      email: '',
      password: '',
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
      isValid = await form.trigger(['email', 'password', 'businessName']);
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

      // Create Supabase account
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account.');
      }

      // Save merchant data to Supabase 'merchants' table
      const { error: merchantError } = await supabase
        .from('merchants')
        .insert({
          user_id: authData.user.id,
          email: data.email,
          business_name: data.businessName,
          business_type: finalBusinessType,
          logo_url: logoDataUri, // Changed from logo
          colors: {
            primary: brandColors.primary,
            secondary: brandColors.secondary,
            accent: brandColors.accent,
          },
        });

      if (merchantError) {
        // Potentially roll back user creation or notify user to try again
        throw new Error(`Failed to save merchant data: ${merchantError.message}`);
      }

      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
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
