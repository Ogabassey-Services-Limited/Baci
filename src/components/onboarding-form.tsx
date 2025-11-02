
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Loader2, Sparkles, Upload, CheckCircle, Copy, Mail, KeyRound, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { getAllBusinessTypes } from '@/config/business-types';
import type { BrandColors, GuideBusinessOnboardingInput } from '@/ai/flows/guide-business-onboarding';
import { PasswordStrengthIndicator, checkPasswordStrength } from '@/components/password-strength-indicator';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import { submitOnboarding, type ServerActionState } from '@/app/onboarding/actions';
import ColorThief from 'colorthief';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { z } from 'zod';


const onboardingSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().optional(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  brandPreferences: z.string().optional(),
})
.refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
      return false;
    }
    return true;
  }, {
    message: "If you select 'Other', please specify your business type.",
    path: ["otherBusinessType"],
})
.refine(data => {
    if (checkPasswordStrength(data.password || '') >= 3) {
        return data.password === data.confirmPassword;
    }
    return true;
}, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});


type OnboardingFormValues = z.infer<typeof onboardingSchema>;


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
              <Input placeholder="e.g., Amara's Fashion" {...field} onKeyDown={onKeyDown} />
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
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger onKeyDown={onKeyDown}>
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
                <Input placeholder="e.g., Pet Services" {...field} value={field.value || ''} onKeyDown={onKeyDown} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}


function Step2_Branding({ onLogoUpdate, onColorsUpdate, brandColors, onKeyDown }: { onLogoUpdate: (logo: string | null) => void; onColorsUpdate: (colors: BrandColors | null) => void; brandColors: BrandColors | null; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; }) {
  const form = useFormContext<OnboardingFormValues>();
  const { toast } = useToast();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);
  const [selectedGeneratedLogoIndex, setSelectedGeneratedLogoIndex] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPrompt, setShowColorPrompt] = useState(false);
  
  const [colorRoles, setColorRoles] = useState<('primary' | 'secondary' | 'accent')[]>(['primary', 'secondary', 'accent']);


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
        setLogoPreview(dataUri);
        onLogoUpdate(dataUri);
        setGeneratedLogos([]);
        setSelectedGeneratedLogoIndex(null);
        setIsExtracting(true);
        try {
          const colors = await extractColorsFromImage(dataUri);
          onColorsUpdate(colors);
          toast({ title: 'Brand colors extracted!', description: 'You can shuffle them if you like.' });
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

  const handleGenerateClick = () => setShowColorPrompt(true);

  const handleGenerateLogos = async () => {
    const { businessName, businessType, brandPreferences, otherBusinessType } = form.getValues();
    setIsGenerating(true);
    // Reset state
    setGeneratedLogos([]);
    setSelectedGeneratedLogoIndex(null);
    onLogoUpdate(null);
    onColorsUpdate(null);

    try {
      const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;
      
      const flowInput: GuideBusinessOnboardingInput = {
          businessName,
          businessType: finalBusinessType,
          brandPreferences: brandPreferences || '',
          task: 'generate_logos'
      };

      const result = await guideBusinessOnboarding(flowInput);
      
      if (!result.logos || result.logos.length === 0) {
        toast({
            title: 'AI Logo Generation Unavailable',
            description: 'To generate logos, please add your Google AI API key to a .env file.',
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
      const colors = await extractColorsFromImage(selectedLogo);
      onColorsUpdate(colors);
      toast({ title: 'Logo selected and colors extracted!' });
    } catch (e) {
      logger.error({ error: e as Error, message: 'Color extraction from generated logo failed.' });
      toast({ title: 'Failed to process selected logo', description: (e as Error).message, variant: 'destructive' });
      onColorsUpdate(null);
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
    
    // To correctly cycle values, we map the old roles to the new values.
    const remappedColors: BrandColors = {
        primary: brandColors.secondary,
        secondary: brandColors.accent,
        accent: brandColors.primary,
    };

    onColorsUpdate(remappedColors);
  };
  
  const displayedColors = brandColors ? [
    { role: 'primary', color: brandColors.primary },
    { role: 'secondary', color: brandColors.secondary },
    { role: 'accent', color: brandColors.accent },
] : [];

  return (
    <div className='space-y-4' onKeyDown={onKeyDown} tabIndex={-1}>
      <FormLabel className="text-lg">Do you have a logo?</FormLabel>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <div className="space-y-2">
            <div className={cn("relative border-2 border-dashed rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center transition-colors", logoPreview ? 'border-green-500 bg-green-50/50' : 'border-muted-foreground/50')}>
            {logoPreview ? (
                <>
                <Image src={logoPreview} alt="Uploaded Logo Preview" fill className="rounded-md p-2 object-contain" />
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md"><CheckCircle className="w-4 h-4 text-white" /></div>
                </>
            ) : (<><Upload className="w-8 h-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p></>)}
             {isExtracting && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
            <Input id="logo-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} aria-label="Upload logo file" disabled={isLoading}/>
            </div>
            {brandColors && (
                <div className="pt-2 animate-fade-in space-y-2">
                    <div className="flex items-center gap-2 justify-center"><CheckCircle className="w-4 h-4 text-green-500" /><p className="text-sm font-medium">Brand Colors Extracted</p></div>
                    <div className="grid grid-cols-3 gap-2">
                        {displayedColors.map(({ role, color }) => (
                            <div key={role} className="space-y-1 text-center">
                                <div className="h-10 w-full rounded-md border-2 border-border shadow-sm" style={{ backgroundColor: color }} title={color} />
                                <p className="text-[10px] font-medium text-muted-foreground capitalize">{role}</p>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleShuffleColors} disabled={isLoading}>
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Shuffle Colors
                    </Button>
                </div>
            )}
        </div>
        <div className="relative flex items-center justify-center md:hidden"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-muted-foreground/30"></div></div><span className="relative bg-background px-2 text-sm text-muted-foreground">or</span></div>
        <div className="flex flex-col items-center justify-center h-48 space-y-4">
          {!showColorPrompt ? <Button type="button" variant="outline" onClick={handleGenerateClick} className="w-full"><Sparkles className="mr-2 h-4 w-4" />Generate with AI</Button> : (
            <div className="w-full space-y-2">
              <FormField control={form.control} name="brandPreferences" render={({ field }) => (
                  <FormItem>
                    <FormLabel>What's your favorite color?</FormLabel>
                    <Input {...field} placeholder="e.g., 'deep ocean blue'" onKeyDown={handlePreferenceKeyDown} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={handleGenerateLogos} disabled={isGenerating} className='w-full'>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate Logos</Button>
            </div>
          )}
        </div>
      </div>
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

function Step3_Account({ onKeyDown }: { onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; }) {
  const { control, watch, trigger } = useFormContext<OnboardingFormValues>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValue = watch('password');
  const emailValue = watch('email');
  const passwordStrength = useMemo(() => checkPasswordStrength(passwordValue || ''), [passwordValue]);

  const isPasswordStrong = passwordStrength >= 3;
  
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  useEffect(() => {
    const checkEmail = async () => {
        const result = await trigger("email");
        setShowPasswordFields(result);
    };
    if (emailValue) {
        checkEmail();
    } else {
        setShowPasswordFields(false);
    }
  }, [emailValue, trigger]);

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
                        <Input type="email" placeholder="you@example.com" {...field} onKeyDown={onKeyDown} className="pl-10" />
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        
        {showPasswordFields && (
            <>
            <FormField
                control={control}
                name="password"
                render={({ field }) => (
                    <FormItem className="animate-fade-in">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" {...field} onKeyDown={onKeyDown} className="pl-10 pr-10" />
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
                                <Input type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" {...field} value={field.value || ''} onKeyDown={onKeyDown} className="pl-10 pr-10" />
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
            </>
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
    toast({ title: "Copied to clipboard!", description: "Your store URL is ready to be shared." });
  };
  return (
    <div className="text-center space-y-4 flex flex-col items-center">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <h3 className="text-2xl font-semibold">Your Store is Ready!</h3>
      <p className="text-muted-foreground">Congratulations! Your new e-commerce store has been created.</p>
      <div className="w-full max-w-sm p-4 border rounded-lg bg-muted flex items-center justify-between">
        <span className="font-mono text-sm truncate">https://{storeUrl}</span>
        <Button variant="ghost" size="icon" onClick={copyToClipboard}><Copy className="w-4 h-4" /></Button>
      </div>
      <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
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
  const isLastStep = currentStep === totalSteps;
  
  return (
    <div className="flex justify-between pt-4">
      {currentStep > 1 ? (<Button type="button" variant="outline" onClick={onPrev} disabled={isLoading}>Previous</Button>) : <div />}
      {isLastStep ? (<Button type="submit" disabled={isLoading} id="submit-button">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create My Store</Button>) : (<Button type="button" onClick={onNext} disabled={isLoading}>Next</Button>)}
    </div>
  );
}

// --- Main Form Component ---
export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<BrandColors | null>(null);
  const [submissionState, setSubmissionState] = useState<ServerActionState>({ message: '', success: false });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const totalSteps = 3;

  const form = useForm<OnboardingFormValues>({ 
      resolver: zodResolver(onboardingSchema),
      mode: 'onBlur',
      defaultValues: { email: '', password: '', confirmPassword: '', businessName: '', businessType: '', otherBusinessType: '', brandPreferences: '' },
  });
  
  const { getValues, trigger } = form;

  useEffect(() => {
    if (submissionState.message) {
        if (submissionState.success && submissionState.businessName) {
            toast({ title: 'Store Created!', description: 'Your e-commerce store is ready.' });
            setStep(totalSteps + 1); // Go to success step
        } else if (!submissionState.success) {
            toast({ title: 'Onboarding Failed', description: submissionState.message, variant: 'destructive' });
        }
        setIsLoading(false);
    }
  }, [submissionState, toast]);

  const handleNext = async () => {
    let isValid = false;
    if (step === 1) {
        const fieldsToValidate: (keyof OnboardingFormValues)[] = ['businessName', 'businessType'];
        if (getValues('businessType') === 'other') {
            fieldsToValidate.push('otherBusinessType');
        }
        isValid = await trigger(fieldsToValidate);
    } else if (step === 2) {
        if (logoDataUri && brandColors) {
            isValid = true;
        } else {
            toast({ title: 'Branding Incomplete', description: 'Please upload or generate a logo to proceed.', variant: 'destructive' });
        }
    }
    
    if (isValid) {
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

  const handleFormAction = async () => {
    const isValid = await trigger();
    if (!isValid) {
        toast({
            title: 'Form is incomplete',
            description: 'Please review all steps and correct any errors before submitting.',
            variant: 'destructive',
        });
        return;
    }

    setIsLoading(true);
    const formData = new FormData();
    const formValues = form.getValues();

    Object.entries(formValues).forEach(([key, value]) => {
        if (value) {
            formData.append(key, value);
        }
    });

    if (logoDataUri) formData.append('logoDataUri', logoDataUri);
    if (brandColors) formData.append('brandColors', JSON.stringify(brandColors));

    const result = await submitOnboarding(submissionState, formData);
    setSubmissionState(result);
  };
  
  if (step > totalSteps && submissionState.businessName) return <Step4_Success businessName={submissionState.businessName} />;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-center font-headline">Welcome to Baci</h2>
        <p className="text-muted-foreground text-center">Let's set up your store in a few simple steps.</p>
      </header>
       {!submissionState.success && submissionState.message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{submissionState.message}</AlertDescription>
        </Alert>
      )}
      <StepIndicator currentStep={step} totalSteps={totalSteps} />
      <FormProvider {...form}>
        <form action={handleFormAction} aria-label="Store onboarding form" noValidate>
          <div role="region" aria-live="polite" aria-atomic="true" className="min-h-[250px]">
            {step === 1 && <Step1_BusinessDetails onKeyDown={handleKeyDown} />}
            {step === 2 && <Step2_Branding onLogoUpdate={setLogoDataUri} onColorsUpdate={setBrandColors} brandColors={brandColors} onKeyDown={handleKeyDown} />}
            {step === 3 && <Step3_Account onKeyDown={handleKeyDown} />}
          </div>
          <OnboardingNavigation currentStep={step} totalSteps={totalSteps} onNext={handleNext} onPrev={handlePrev} isLoading={isLoading} />
        </form>
      </FormProvider>
    </div>
  );
}
