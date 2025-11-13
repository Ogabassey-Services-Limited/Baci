
'use client';

import { useState, useMemo, useEffect, useActionState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Loader2, Sparkles, Upload, CheckCircle, Mail, KeyRound, Eye, EyeOff, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn, checkPasswordStrength } from '@/lib/utils';
import { getAllBusinessTypes } from '@/config/business-types';
import type { BrandColors } from '@/types';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { submitOnboarding, sendMagicLink, type ServerActionState } from '@/app/onboarding/actions';
import ColorThief from 'colorthief';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { OnboardingFormValues, onboardingSchema, step1Schema, step2Schema, step3Schema } from '@/schemas/onboarding';
import { StorefrontPreview } from './storefront-preview';
import { ThemedButton } from './themed';


// --- Step Components ---

function StepIndicator({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) {
  const progress = Math.max(0, ((currentStep - 1) / (totalSteps -1)) * 100);
  return (
    <div className="flex items-center gap-4" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps} aria-label="Onboarding progress">
      <Progress value={progress} className="w-full" />
      <span className="text-sm text-muted-foreground whitespace-nowrap" aria-live="polite">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

function Step1_BusinessDetails({ onKeyDown }: { onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => void; }) {
  const { control, watch } = useFormContext<OnboardingFormValues>();
  const businessTypeValue = watch('businessType');
  const businessTypes = useMemo(() => getAllBusinessTypes(), []);

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name="businessName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">What is your business name?</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Amara's Fashion" {...field} onKeyDown={onKeyDown} id="businessName" name="businessName" autoComplete="organization" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="businessType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">What's the nature of your business?</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} name="businessType" >
              <FormControl>
                <SelectTrigger onKeyDown={onKeyDown} id="businessType" >
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
                <Input placeholder="e.g., Pet Services" {...field} value={field.value || ''} onKeyDown={onKeyDown} id="otherBusinessType" name="otherBusinessType" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}


function Step2_Branding({ onKeyDown }: { onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; }) {
  const form = useFormContext<OnboardingFormValues>();
  const { toast } = useToast();
  const { watch, setValue, getValues } = form;

  const businessName = watch('businessName');
  const logoDataUri = watch('logoDataUri');
  const brandColorsString = watch('brandColors');
  const brandColors: BrandColors | null = brandColorsString ? JSON.parse(brandColorsString) : null;

  const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);
  const [selectedGeneratedLogoIndex, setSelectedGeneratedLogoIndex] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPrompt, setShowColorPrompt] = useState(false);

  const isLoading = isGenerating || isExtracting;

  const extractColorsFromImage = (imageDataUri: string): Promise<BrandColors> => {
    return new Promise((resolve, reject) => {
      const colorThief = new ColorThief();
      const img = document.createElement('img');
      img.src = imageDataUri;

      img.onload = async () => {
        try {
          const palette = colorThief.getPalette(img, 3);
          const [primary, secondary, accent] = palette.map(
            (rgb: number[]) => `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`
          );
          resolve({ primary, secondary, accent });
        } catch (e) {
          reject(e);
        }
      };
      
      img.onerror = (e) => {
        reject(new Error('Image could not be loaded for color extraction.'));
      };
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setValue('logoDataUri', dataUri, { shouldValidate: true });
        setGeneratedLogos([]);
        setSelectedGeneratedLogoIndex(null);
        setIsExtracting(true);
        try {
          const colors = await extractColorsFromImage(dataUri);
          setValue('brandColors', JSON.stringify(colors), { shouldValidate: true });
          toast({ title: 'Brand colors extracted!', description: 'You can shuffle them or preview your store.' });
        } catch (e) {
          logger.error({ error: e as Error, message: 'Color extraction failed.' });
          toast({ title: 'Color extraction failed', description: (e as Error).message, variant: 'destructive' });
          setValue('brandColors', '', { shouldValidate: true });
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateClick = () => setShowColorPrompt(true);

  const handleGenerateLogos = async () => {
    toast({
        title: 'AI Logo Generation Unavailable',
        description: 'This feature is not yet configured. Please upload a logo.',
        variant: 'destructive'
    });
  };

  const handleSelectAndContinue = async () => {
    if (selectedGeneratedLogoIndex === null) return;
    const selectedLogo = generatedLogos[selectedGeneratedLogoIndex];
    setValue('logoDataUri', selectedLogo, { shouldValidate: true });
    setIsExtracting(true);
    try {
      const colors = await extractColorsFromImage(selectedLogo);
      setValue('brandColors', JSON.stringify(colors), { shouldValidate: true });
      toast({ title: 'Logo selected and colors extracted!' });
    } catch (e) {
      logger.error({ error: e as Error, message: 'Color extraction from generated logo failed.' });
      toast({ title: 'Failed to process selected logo', description: (e as Error).message, variant: 'destructive' });
      setValue('brandColors', '', { shouldValidate: true });
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePreferenceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerateLogos();
    }
  };

  const handleShuffleColors = () => {
    if (!brandColors) return;
    
    const remappedColors: BrandColors = {
        primary: brandColors.secondary,
        secondary: brandColors.accent,
        accent: brandColors.primary,
    };

    setValue('brandColors', JSON.stringify(remappedColors), { shouldValidate: true });
  };
  
  const displayedColors = brandColors ? [
    { role: 'primary', color: brandColors.primary },
    { role: 'secondary', color: brandColors.secondary },
    { role: 'accent', color: brandColors.accent },
] : [];

return (
    <div className='space-y-4'>
      <FormLabel className="text-lg">Do you have a logo?</FormLabel>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <div className="space-y-2">
            <div className={cn("relative border-2 border-dashed rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center transition-colors", logoDataUri ? 'border-green-500 bg-green-50/50' : 'border-muted-foreground/50')}>
            {logoDataUri ? (
                <>
                <Image src={logoDataUri} alt="Uploaded Logo Preview" fill className="rounded-md p-2 object-contain" />
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md"><CheckCircle className="w-4 h-4 text-white" /></div>
                </>
            ) : (<><Upload className="w-8 h-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p></>)}
             {isExtracting && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
            <Input id="logo-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} aria-label="Upload logo file" disabled={isLoading}/>
            </div>
        </div>
        <div className="relative flex items-center justify-center md:hidden"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-muted-foreground/30"></div></div><span className="relative bg-background px-2 text-sm text-muted-foreground">or</span></div>
        <div className="flex flex-col items-center justify-center h-48 space-y-4">
          {!showColorPrompt ? <Button type="button" variant="outline" onClick={handleGenerateClick} className="w-full"><Sparkles className="mr-2 h-4 w-4" />Generate with AI</Button> : (
            <div className="w-full space-y-2">
              <FormField control={form.control} name="brandPreferences" render={({ field }) => (
                  <FormItem>
                    <FormLabel>What's your favorite color?</FormLabel>
                    <Input {...field} placeholder="e.g., 'deep ocean blue'" onKeyDown={handlePreferenceKeyDown} id="brandPreferences" name="brandPreferences" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={handleGenerateLogos} disabled={isGenerating} className='w-full'>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate Logos</Button>
            </div>
          )}
        </div>
      </div>
      {brandColors && (
        <div className='mt-6 animate-fade-in'>
            <div className="flex items-center justify-between mb-4">
                <div className='text-sm text-muted-foreground font-medium'>Live Preview</div>
                <ThemedButton type="button" variant="outline" size="sm" onClick={handleShuffleColors} disabled={isLoading}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Shuffle Colors
                </ThemedButton>
            </div>
             <StorefrontPreview 
                businessName={businessName}
                logoDataUri={logoDataUri}
                brandColors={brandColors}
             />
        </div>
      )}
      <FormField control={form.control} name="logoDataUri" render={() => <FormItem><FormMessage /></FormItem>} />
       <FormField control={form.control} name="brandColors" render={() => <FormItem><FormMessage /></FormItem>} />
      {isGenerating && <div className="text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /><p>Generating logo options... this can take a moment.</p></div>}
      {generatedLogos.length > 0 && (
        <div className="mt-8 space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold text-center">Choose your favorite logo:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {generatedLogos.map((logo, index) => (<div key={index} onClick={() => !isLoading && setSelectedGeneratedLogoIndex(index)} className={cn("p-2 border-2 rounded-lg cursor-pointer transition-all bg-muted/50 hover:border-primary", selectedGeneratedLogoIndex === index ? 'border-primary' : 'border-transparent')}><Image src={logo} alt={`Logo option ${index + 1}`} width={150} height={150} className="w-full h-auto object-contain rounded-md aspect-square" /></div>))}
          </div>
          <Button type="button" onClick={handleSelectAndContinue} disabled={selectedGeneratedLogoIndex === null || isLoading} className="w-full">{isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue with Selected Logo</Button>
        </div>
      )}
    </div>
  );
}

function Step3_Account({ onKeyDown, onMagicLinkSent }: { onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; onMagicLinkSent: () => void; }) {
  const { control, watch, trigger, getValues } = useFormContext<OnboardingFormValues>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const { toast } = useToast();

  const emailValue = watch('email');
  const passwordValue = watch('password');
  const passwordStrength = useMemo(() => checkPasswordStrength(passwordValue || ''), [passwordValue]);
  
  const showPasswordFields = useMemo(() => {
    return emailValue?.includes('@');
  }, [emailValue]);

  const isPasswordStrong = passwordStrength >= 3;

  const handleMagicLinkClick = async () => {
    setIsMagicLinkLoading(true);
    const isEmailValid = await trigger('email');
    if (!isEmailValid) {
      setIsMagicLinkLoading(false);
      return;
    }
    const email = getValues('email');
    const result = await sendMagicLink(email);
    if (result.success) {
      toast({ title: 'Magic link sent!', description: 'Check your email to sign in.' });
      onMagicLinkSent();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsMagicLinkLoading(false);
  };

  return (
    <div className='space-y-4'>
       <h3 className="text-xl font-semibold text-center">Create your account</h3>
        <FormField
            control={control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="you@example.com" {...field} className="pl-10" id="email" name="email" autoComplete="email" />
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        
        {showPasswordFields && (
          <div className='space-y-4'>
            <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-muted-foreground/30"></div>
                </div>
                <span className="relative bg-background px-2 text-sm text-muted-foreground">or</span>
            </div>

            <Button type="button" variant="outline" onClick={handleMagicLinkClick} className="w-full" disabled={isMagicLinkLoading}>
                {isMagicLinkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Continue with Magic Link
            </Button>
          </div>
        )}
        
        {showPasswordFields && (
            <div className="space-y-4 mt-4">
              <FormField
                  control={control}
                  name="password"
                  render={({ field }) => (
                      <FormItem className="animate-fade-in">
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                          <div className="relative">
                              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" {...field} onKeyDown={onKeyDown} className="pl-10 pr-10" id="password" name="password" autoComplete="new-password" />
                              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                                  <Input type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" {...field} value={field.value || ''} onKeyDown={onKeyDown} className="pl-10 pr-10" id="confirmPassword" name="confirmPassword" autoComplete="new-password" />
                                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                              </div>
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
              )}
            </div>
        )}
    </div>
  );
}

function OnboardingNavigation({ currentStep, totalSteps, onNext, onPrev, isLoading, isStepValid }: {
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
      {currentStep > 1 ? (<Button type="button" variant="outline" onClick={onPrev} disabled={isLoading}>Previous</Button>) : <div />}
      {isLastStep ? (<Button type="submit" disabled={isLoading || !isStepValid} id="submit-button">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create My Store</Button>) : (<Button type="button" onClick={onNext} disabled={isLoading}>Next</Button>)}
    </div>
  );
}

// --- Main Form Component ---
export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [submissionState, formAction, isPending] = useActionState<ServerActionState, FormData>(submitOnboarding, { message: '', success: false });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const totalSteps = 3;
  const searchParams = useSearchParams();

  const form = useForm<OnboardingFormValues>({ 
      resolver: zodResolver(onboardingSchema),
      mode: 'onBlur',
      reValidateMode: 'onBlur',
      shouldUnregister: false,
      defaultValues: { email: '', password: '', confirmPassword: '', businessName: '', businessType: '', otherBusinessType: '', brandPreferences: '', logoDataUri: '', brandColors: '' },
  });

  const { formState: { errors } } = form;

  useEffect(() => {
    const fromMagicLink = searchParams.get('fromMagicLink');
    if (fromMagicLink) {
        const savedData = localStorage.getItem('onboardingForm');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            form.reset(parsedData.values);
            form.setValue('logoDataUri', parsedData.logoDataUri);
            form.setValue('brandColors', parsedData.brandColors);
            setStep(3);
            toast({ title: "Welcome back!", description: "You are now logged in. Please click 'Create My Store' to finish.", duration: 5000 });
        }
    }
  }, [searchParams, form, toast]);

  useEffect(() => {
    if (submissionState.success) {
        localStorage.removeItem('onboardingForm');
        toast({ title: 'Store Created!', description: 'Your e-commerce store is ready. Redirecting you to the dashboard...' });
        router.push('/dashboard');
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
           toast({ title: 'An error occurred', description: submissionState.message, variant: 'destructive' });
        }
    }
  }, [submissionState, form, toast, router]);
  
  const handleNext = async () => {
    let isValidStep = false;
    if (step === 1) {
        isValidStep = await form.trigger(['businessName', 'businessType', 'otherBusinessType']);
    } else if (step === 2) {
        isValidStep = await form.trigger(['logoDataUri', 'brandColors']);
        if (!isValidStep) {
             toast({ title: 'Branding Incomplete', description: 'Please upload or generate a logo to proceed.', variant: 'destructive' });
        }
    }
    
    if (isValidStep) {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => { if (step > 1) setStep(s => s - 1); };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
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
            email: values.email
        },
        logoDataUri: values.logoDataUri,
        brandColors: values.brandColors,
    };
    localStorage.setItem('onboardingForm', JSON.stringify(dataToSave));
    setMagicLinkSent(true);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const values = form.getValues();

    const formData = new FormData();
    formData.append('email', values.email || '');
    formData.append('password', values.password || '');
    formData.append('confirmPassword', values.confirmPassword || '');
    formData.append('businessName', values.businessName || '');
    formData.append('businessType', values.businessType || '');
    formData.append('otherBusinessType', values.otherBusinessType || '');
    formData.append('brandPreferences', values.brandPreferences || '');
    formData.append('logoDataUri', values.logoDataUri || '');
    formData.append('brandColors', values.brandColors || '');

    startTransition(() => {
      formAction(formData);
    });
  };

  const formEmail = form.watch('email');
  const formPassword = form.watch('password');
  const formConfirmPassword = form.watch('confirmPassword');

  const isStep3Valid = useMemo(() => {
    if (step !== 3) return true;
    const validationData = { email: formEmail, password: formPassword, confirmPassword: formConfirmPassword };
    const result = step3Schema.safeParse(validationData);
    return result.success;
  }, [formEmail, formPassword, formConfirmPassword, step]);
  
  const isCurrentStepValid = useMemo(() => {
    if (step === 1) return !errors.businessName && !errors.businessType && !errors.otherBusinessType;
    if (step === 2) return !errors.logoDataUri && !errors.brandColors;
    if (step === 3) return isStep3Valid;
    return false;
  }, [step, errors, isStep3Valid]);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-center font-headline">Welcome to Baci</h2>
        <p className="text-muted-foreground text-center">Let's set up your store in a few simple steps.</p>
      </header>
      <StepIndicator currentStep={step} totalSteps={totalSteps} />
      <FormProvider {...form}>
        <form onSubmit={handleFormSubmit} aria-label="Store onboarding form" noValidate>
            <input type="hidden" {...form.register('logoDataUri')} />
            <input type="hidden" {...form.register('brandColors')} />
          <div role="region" aria-live="polite" aria-atomic="true" className="min-h-[250px]">
            {step === 1 && <Step1_BusinessDetails onKeyDown={handleKeyDown} />}
            {step === 2 && <Step2_Branding onKeyDown={handleKeyDown} />}
            {step === 3 && (
                magicLinkSent ? (
                    <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Magic Link Sent!</AlertTitle>
                        <AlertDescription>
                            Please check your email for a link to sign in. You can close this window.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Step3_Account onKeyDown={handleKeyDown} onMagicLinkSent={handleMagicLinkSent} />
                )
            )}
          </div>
          <OnboardingNavigation currentStep={step} totalSteps={totalSteps} onNext={handleNext} onPrev={handlePrev} isLoading={isPending || isSubmitting} isStepValid={isCurrentStepValid} />
        </form>
      </FormProvider>
    </div>
  );
}
