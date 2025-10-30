'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';


const formSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  logoChoice: z.enum(['upload', 'generate'], { required_error: "Please choose an option."}),
  brandPreferences: z.string().optional(),
  logo: z.any().optional(),
}).refine(data => {
    if (data.businessType === 'other' && !data.otherBusinessType) {
        return false;
    }
    return true;
}, {
    message: "Please specify your business type.",
    path: ["otherBusinessType"],
}).refine(data => {
    if (data.logoChoice === 'generate' && !data.brandPreferences) {
        return false;
    }
    return true;
}, {
    message: "Favorite color is required to generate a logo.",
    path: ["brandPreferences"],
});

type OnboardingFormValues = z.infer<typeof formSchema>;

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      otherBusinessType: '',
      logoChoice: undefined,
      brandPreferences: '',
    },
    mode: 'onChange',
  });

  const logoChoice = form.watch('logoChoice');
  const totalSteps = logoChoice === 'generate' ? 4 : 3;

  const handleNext = async () => {
    let fieldsToValidate: (keyof OnboardingFormValues)[] = [];
    if (step === 1) {
        fieldsToValidate = ['businessName'];
    } else if (step === 2) {
        fieldsToValidate = ['businessType', 'otherBusinessType'];
    } else if (step === 3) {
        fieldsToValidate = ['logoChoice'];
    } else if (step === 4 && logoChoice === 'generate') {
        fieldsToValidate = ['brandPreferences'];
    }
    
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid) {
      if (step === 3) {
         setStep(4);
      } else {
          setStep(step + 1);
      }
    }
  };

  const handlePrev = () => {
     if (step === 4) {
        setStep(3);
    } else {
        setStep(step - 1);
    }
  };
  
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setLogoPreview(dataUri);
        form.setValue('logo', dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogo = async () => {
    const { businessName, businessType, brandPreferences, otherBusinessType } = form.getValues();
    
    await form.trigger(['brandPreferences']);
    const hasBrandPreferenceError = !!form.formState.errors.brandPreferences;

    if (!brandPreferences || hasBrandPreferenceError) {
        form.setError('brandPreferences', { message: 'This field is required.' });
        toast({ title: "Favorite color is required", description: "Please tell us your favorite color to generate a logo.", variant: 'destructive'});
        return;
    }
    
    setIsLoading(true);
    try {
      const result = await guideBusinessOnboarding({
        businessName,
        businessType: businessType === 'other' ? otherBusinessType! : businessType,
        brandPreferences,
      });
      if (result.logoDataUri) {
        setLogoPreview(result.logoDataUri);
        form.setValue('logo', result.logoDataUri);
        setStep(5);
      }
    } catch (e) {
      logger.error({ error: e, message: 'Logo generation failed in onboarding form.' });
      toast({
        title: 'Logo Generation Failed',
        description:
          'There was an error generating the logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    if (logoChoice === 'upload' && !logoPreview) {
        form.setError('logo', { message: "Please upload a logo."});
        return;
    }
     if (logoChoice === 'generate' && !logoPreview) {
        toast({
            title: "Logo required",
            description: "Please generate a logo before submitting.",
            variant: "destructive"
        });
        setStep(4);
        return;
    }

    setIsLoading(true);
    try {
        const finalBusinessType = data.businessType === 'other' ? data.otherBusinessType : data.businessType;
        const finalLogo = data.logo || logoPreview;

        await guideBusinessOnboarding({
            businessName: data.businessName,
            businessType: finalBusinessType!,
            brandPreferences: data.brandPreferences!,
            logoDataUri: finalLogo
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

  const businessTypeValue = form.watch('businessType');
  const currentDisplayStep = logoChoice === 'generate' && step > 3 ? step -1 : step;
  
  const isFinalUploadStep = logoChoice === 'upload' && step === 4;
  const isFinalGenerateStep = logoChoice === 'generate' && step === 5;
  const isFinalStep = isFinalUploadStep || isFinalGenerateStep;


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
        <Progress value={(currentDisplayStep / totalSteps) * 100} className="w-full" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Step {currentDisplayStep} of {totalSteps}
        </span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
             <FormField
              control={form.control}
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
          )}

          {step === 2 && (
              <>
                <FormField
                control={form.control}
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
                        control={form.control}
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
          )}

           {step === 3 && (
                <FormField
                control={form.control}
                name="logoChoice"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel className='text-lg'>Do you have a logo?</FormLabel>
                         <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                            >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="upload" />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        Yes, I'll upload it
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="generate" />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        No, generate one for me with AI
                                    </FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
          )}
          
          {step === 4 && logoChoice === 'generate' && (
            <div className="space-y-4 text-center">
                 <FormField
                    control={form.control}
                    name="brandPreferences"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-lg">What's your favorite color?</FormLabel>
                        <Input
                            {...field}
                            placeholder="e.g., 'deep ocean blue', 'forest green', 'sunny yellow'"
                        />
                        <p className="text-sm text-muted-foreground">This will help our AI generate a logo and brand palette for you.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <Button type="button" variant="outline" onClick={handleGenerateLogo} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate with AI
                  </Button>
            </div>
          )}

          {(step === 4 && logoChoice === 'upload') || (step === 5 && logoChoice === 'generate') && (
            <div className='space-y-4'>
                <FormLabel className="text-lg">
                    {logoChoice === 'upload' ? 'Upload your logo' : 'Here is your new logo!'}
                </FormLabel>

                {logoPreview && (
                    <div className="relative w-full h-48 border-2 border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center">
                        <Image
                            src={logoPreview}
                            alt="Logo Preview"
                            layout="fill"
                            objectFit="contain"
                            className="rounded-md p-4"
                        />
                    </div>
                )}
                
                {logoChoice === 'upload' && !logoPreview && (
                    <div className={cn("relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center")}>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
                        <Input
                            id="logo-upload"
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/*"
                            onChange={handleLogoChange}
                        />
                    </div>
                )}
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
          )}


          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrev} disabled={isLoading}>
                Previous
              </Button>
            ) : (
              <div></div>
            )}
            {!isFinalStep ? (
               <Button type="button" onClick={handleNext} disabled={isLoading || (step === 3 && !logoChoice)}>
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
      </Form>
    </div>
  );
}
