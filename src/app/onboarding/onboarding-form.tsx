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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

const step1Schema = z.object({
  businessType: z.string().min(1, 'Please select a business type.'),
});

const step2Schema = z.object({
  brandPreferences: z.string().min(10, 'Please describe your brand.'),
});

const step3Schema = z.object({
  logo: z.any().optional(),
});

const formSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type OnboardingFormValues = z.infer<typeof formSchema>;

const totalSteps = 3;

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(
      step === 1 ? step1Schema : step === 2 ? step2Schema : step3Schema
    ),
    defaultValues: {
      businessType: '',
      brandPreferences: '',
    },
  });

  const handleNext = async () => {
    const isValid = await form.trigger(
      step === 1 ? ['businessType'] : ['brandPreferences']
    );
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
        setLogoPreview(reader.result as string);
        setGeneratedLogo(null);
        form.setValue('logo', file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogo = async () => {
    setIsLoading(true);
    setLogoPreview(null);
    // Simulate AI logo generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const generated = 'https://picsum.photos/seed/logo-gen/200/200';
    setGeneratedLogo(generated);
    form.setValue('logo', generated);
    setIsLoading(false);
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsLoading(true);
    // Simulate API call to guideBusinessOnboarding
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    console.log('Onboarding data:', data);
    toast({
      title: 'Store Created!',
      description: "We're redirecting you to your new dashboard.",
    });

    router.push('/dashboard');
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <FormField
              control={form.control}
              name="businessType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">What kind of business are you starting?</FormLabel>
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {step === 2 && (
            <FormField
              control={form.control}
              name="brandPreferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Describe your brand's style and vibe.</FormLabel>
                  <Textarea
                    {...field}
                    placeholder="e.g., 'Modern and minimalist with a touch of luxury', 'Earthy, natural, and eco-friendly'"
                    rows={4}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <FormLabel className="text-lg">Do you have a logo?</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 h-48 flex flex-col items-center justify-center text-center">
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
                <div className="flex flex-col items-center justify-center space-y-4 h-48">
                  {(logoPreview || generatedLogo) && (
                    <div className="w-24 h-24 relative">
                      <Image
                        src={logoPreview || generatedLogo || ''}
                        alt="Logo Preview"
                        layout="fill"
                        objectFit="contain"
                        className="rounded-md"
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">or</p>
                  <Button type="button" variant="outline" onClick={handleGenerateLogo} disabled={isLoading}>
                    {isLoading && !generatedLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate with AI
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrev}>
                Previous
              </Button>
            ) : (
              <div></div>
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
      </Form>
    </div>
  );
}
