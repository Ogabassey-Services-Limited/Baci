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
import { cn } from '@/lib/utils';


const baseFormSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  brandPreferences: z.string().min(3, 'Favorite color is required.'),
  logo: z.any().optional(),
});

const formSchema = baseFormSchema.refine(data => {
    if (data.businessType === 'other' && !data.otherBusinessType) {
        return false;
    }
    return true;
}, {
    message: "Please specify your business type.",
    path: ["otherBusinessType"],
});

type OnboardingFormValues = z.infer<typeof formSchema>;

const totalSteps = 4;

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(
        step === 1 ? baseFormSchema.pick({ businessName: true }) :
        step === 2 ? baseFormSchema.pick({ businessType: true, otherBusinessType: true }) :
        step === 3 ? baseFormSchema.pick({ brandPreferences: true }) :
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
    let fieldsToValidate: (keyof OnboardingFormValues)[] = [];
    if (step === 1) {
        fieldsToValidate = ['businessName'];
    } else if (step === 2) {
        fieldsToValidate = ['businessType', 'otherBusinessType'];
    } else if (step === 3) {
        fieldsToValidate = ['brandPreferences'];
    }
    
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };
  
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setLogoPreview(dataUri);
        form.setValue('logo', dataUri);
        setGeneratedLogo(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogo = async () => {
    const { businessName, businessType, brandPreferences, otherBusinessType } = form.getValues();
    
    await form.trigger(['brandPreferences']);
    if (!brandPreferences || form.formState.errors.brandPreferences) {
        toast({ title: "Favorite color is required", description: "Please go back and tell us your favorite color to generate a logo.", variant: 'destructive'});
        setStep(3);
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
        setGeneratedLogo(result.logoDataUri);
        form.setValue('logo', result.logoDataUri);
        setLogoPreview(null);
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
    setIsLoading(true);
    try {
        const finalBusinessType = data.businessType === 'other' ? data.otherBusinessType : data.businessType;
        
        let finalLogo = data.logo;

        // If no logo has been uploaded or generated, generate one before submission
        if (!finalLogo && !logoPreview && !generatedLogo) {
             const result = await guideBusinessOnboarding({
                businessName: data.businessName,
                businessType: finalBusinessType!,
                brandPreferences: data.brandPreferences,
            });
            finalLogo = result.logoDataUri;
        }

        // Use the already generated/uploaded logo if available
        if (generatedLogo) finalLogo = generatedLogo;
        if (logoPreview) finalLogo = logoPreview;


        await guideBusinessOnboarding({
            businessName: data.businessName,
            businessType: finalBusinessType!,
            brandPreferences: data.brandPreferences,
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
  const imageToDisplay = logoPreview || generatedLogo;

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
          )}

          {step === 4 && (
            <div className='space-y-4'>
                <FormLabel className="text-lg">Do you have a logo?</FormLabel>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-center'>
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
                     <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-muted-foreground/30 md:hidden"></div>
                            <div className="w-full border-l border-muted-foreground/30 h-full hidden md:block"></div>
                        </div>
                        <span className="relative bg-background px-2 text-sm text-muted-foreground md:-ml-3 md:bg-transparent md:py-2 md:px-0 md:bg-background">or</span>
                    </div>

                    <div className="flex flex-col items-center justify-center h-48">
                         <Button type="button" variant="outline" onClick={handleGenerateLogo} disabled={isLoading}>
                            {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Generate with AI
                        </Button>
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
          )}


          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrev} disabled={isLoading}>
                Previous
              </Button>
            ) : (
              <div></div>
            )}
            {step < totalSteps ? (
               <Button type="button" onClick={handleNext} disabled={isLoading}>
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

    
    