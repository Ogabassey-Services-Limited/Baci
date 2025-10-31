
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
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
import { Loader2, Sparkles, Upload } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

// --- Zod Schema Definition ---
const formSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  brandPreferences: z.string().optional(),
  logo: z.any().optional(),
}).refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
        return false;
    }
    return true;
}, {
    message: "Please specify your business type with at least 2 characters.",
    path: ["otherBusinessType"],
});

type OnboardingFormValues = z.infer<typeof formSchema>;

const totalSteps = 3;

// --- Step Components ---

const Step1 = () => {
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
};

const Step2 = () => {
  const { control, watch } = useFormContext<OnboardingFormValues>();
  const businessTypeValue = watch('businessType');

  return (
    <>
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
                <SelectItem value="fashion">Fashion & Apparel</SelectItem>
                <SelectItem value="electronics">Electronics & Gadgets</SelectItem>
                <SelectItem value="home-goods">Home Goods & Decor</SelectItem>
                <SelectItem value="health-beauty">Health & Beauty</SelectItem>
                <SelectItem value="handmade">Handmade & Crafts</SelectItem>
                <SelectItem value="food-beverage">Food & Beverage</SelectItem>
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
    </>
  );
};

const Step3 = () => {
  const form = useFormContext<OnboardingFormValues>();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showColorPrompt, setShowColorPrompt] = useState(false);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setLogoPreview(dataUri);
        form.setValue('logo', dataUri);
        setGeneratedLogo(null);
        setShowColorPrompt(false); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateClick = () => {
    setShowColorPrompt(true);
  };
  
  const handleGenerateLogo = async () => {
    const isBrandPrefsValid = await form.trigger(['brandPreferences']);
    if (!isBrandPrefsValid) return;

    const { businessName, businessType, brandPreferences, otherBusinessType } = form.getValues();
    
    setIsGenerating(true);
    try {
      const result = await guideBusinessOnboarding({
        businessName,
        businessType: businessType === 'other' ? otherBusinessType! : businessType,
        brandPreferences,
      });
      if (result.logoDataUri) {
        setGeneratedLogo(result.logoDataUri);
        form.setValue('logo', result.logoDataUri);
        setLogoPreview(null);
        setShowColorPrompt(false);
      }
    } catch (e) {
      logger.error({ error: e, message: 'Logo generation failed in onboarding form.' });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const imageToDisplay = logoPreview || generatedLogo;

  return (
    <div className='space-y-4'>
      <FormLabel className="text-lg">Do you have a logo?</FormLabel>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <div className={cn("relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center", {'items-center justify-center': !imageToDisplay})}>
          {imageToDisplay ? (
            <Image src={imageToDisplay} alt="Logo Preview" layout="fill" objectFit="contain" className="rounded-md p-2" />
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
            </>
          )}
          <Input
            id="logo-upload"
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/*"
            onChange={handleLogoChange}
          />
        </div>
        <div className="relative flex items-center justify-center md:hidden">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-muted-foreground/30"></div>
          </div>
          <span className="relative bg-background px-2 text-sm text-muted-foreground">or</span>
        </div>
        <div className="flex flex-col items-center justify-start h-48 space-y-4">
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
              <Button type="button" onClick={handleGenerateLogo} disabled={isGenerating} className='w-full'>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Logo
              </Button>
            </div>
          )}
        </div>
      </div>
      <FormField
        control={form.control}
        name="logo"
        render={({ fieldState }) => (
          <FormItem>
            <FormMessage className='mt-2'>{fieldState.error?.message}</FormMessage>
          </FormItem>
        )}
      />
    </div>
  );
};


// --- Main Form Component ---

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(
      step === 1 ? formSchema.pick({ businessName: true }) :
      step === 2 ? formSchema.pick({ businessType: true, otherBusinessType: true }).refine(data => data.businessType !== 'other' || (data.otherBusinessType && data.otherBusinessType.length >= 2), {
        message: "Please specify your business type with at least 2 characters.",
        path: ["otherBusinessType"],
      }) :
      formSchema
    ),
    defaultValues: {
      businessName: '',
      businessType: '',
      otherBusinessType: '',
      brandPreferences: '',
    },
    mode: 'onChange',
  });

  const handleNext = async () => {
    const fieldsToValidate: (keyof OnboardingFormValues)[] = 
      step === 1 ? ['businessName'] :
      step === 2 ? ['businessType', 'otherBusinessType'] : [];
    
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid && step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => setStep(step - 1);

  const onSubmit = async (data: OnboardingFormValues) => {
    const isValid = await form.trigger();
    if (!isValid) return;

    setIsLoading(true);
    try {
      const finalBusinessType = data.businessType === 'other' ? data.otherBusinessType : data.businessType;
      
      await guideBusinessOnboarding({
        businessName: data.businessName,
        businessType: finalBusinessType!,
        brandPreferences: data.brandPreferences,
        logoDataUri: data.logo,
      });
      
      toast({
        title: 'Store Created!',
        description: "We're redirecting you to your new dashboard.",
      });

      router.push('/dashboard');
    } catch (e) {
      logger.error({ error: e, message: 'Onboarding submission failed.' });
      toast({
        title: 'Onboarding Failed',
        description: 'Could not create your store. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-center font-headline">
          Welcome to Baci
        </h2>
        <p className="text-muted-foreground text-center">
          Let's set up your store in a few simple steps.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Progress value={(step / totalSteps) * 100} className="w-full" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Step {step} of {totalSteps}
        </span>
      </div>

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          
          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrev} disabled={isLoading}>
                Previous
              </Button>
            ) : (
              <div />
            )}
            {step < totalSteps ? (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create My Store
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
