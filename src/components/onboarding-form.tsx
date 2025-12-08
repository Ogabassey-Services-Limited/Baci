'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Data } from '@measured/puck';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import {
  type ServerActionState,
  submitOnboarding,
} from '@/app/onboarding/actions';
import {
  trackMerchantSignupCompleted,
  trackMerchantSignupStarted,
} from '@/components/analytics/platform-analytics-provider';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  type OnboardingFormValues,
  onboardingSchema,
  step3Schema,
} from '@/schemas/onboarding';
import { useOnboardingUIStore } from '@/store/onboarding-ui-store';
import type { BrandColors } from '@/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

// Dynamically import steps
const Step1_BusinessDetails = dynamic(
  () => import('@/components/onboarding/steps/step1-business-details'),
  {
    loading: () => (
      <div className="h-[300px] animate-pulse bg-muted/10 rounded-lg" />
    ),
  }
);

const Step2_Branding = dynamic(
  () => import('@/components/onboarding/steps/step2-branding'),
  {
    loading: () => (
      <div className="h-[500px] animate-pulse bg-muted/10 rounded-lg" />
    ),
  }
);

const Step3_Account = dynamic(
  () => import('@/components/onboarding/steps/step3-account'),
  {
    loading: () => (
      <div className="h-[300px] animate-pulse bg-muted/10 rounded-lg" />
    ),
  }
);

// Dynamically import heavy interactive components for preview
const OnboardingPuckPreview = dynamic(
  () =>
    import('./onboarding-puck-preview').then(
      (mod) => mod.OnboardingPuckPreview
    ),
  {
    ssr: false, // Puck is client-side only
    loading: () => <Skeleton className="h-full w-full min-h-[500px]" />,
  }
);

const OnboardingTemplateEditor = dynamic(
  () =>
    import('./onboarding-template-editor').then(
      (mod) => mod.OnboardingTemplateEditor
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full min-h-[400px]" />,
  }
);

// --- Helper Components ---

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
  const [submissionState, formAction, isPending] = useActionState<
    ServerActionState,
    FormData
  >(submitOnboarding, { message: '', success: false });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [user, setUser] = useState<User | null>(null);

  // Preview State
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

  // Handle successful submission
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

      // Server action succeeded - redirect directly to dashboard
      // The server already verified the session and created the merchant
      // No need to re-check client-side which can have cookie timing issues
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    if (user) return true;
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
    if (step === 2) return !errors.logoUrl && !errors.brandColors;
    if (step === 3) return isStep3Valid;
    return false;
  }, [
    step,
    errors,
    isStep3Valid,
    errors.businessName,
    errors.businessType,
    errors.otherBusinessType,
    errors.logoUrl,
    errors.brandColors,
  ]);

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-in-out w-full',
        showPreview
          ? 'max-w-[90rem] px-4 md:px-8 h-auto lg:h-[calc(100vh-1rem)] flex flex-col lg:flex-row items-center justify-center'
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
              ? 'w-full lg:w-1/2 xl:w-[45%] lg:h-[550px] lg:overflow-hidden'
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
                    className="min-h-[200px] md:min-h-[250px]"
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

        {/* Live Preview Panel - Desktop Only */}
        {showPreview && (
          <div className="hidden lg:block w-full lg:w-1/2 xl:w-[55%] h-[600px] animate-in fade-in slide-in-from-right duration-700 delay-100">
            {isEditorOpen && templateData ? (
              <OnboardingTemplateEditor
                initialData={templateData}
                businessName={businessName}
                brandColors={parsedBrandColors || null}
                onClose={() => setIsEditorOpen(false)}
                onSave={(data) => {
                  setTemplateData(data);
                  setIsEditorOpen(false);
                }}
              />
            ) : (
              <OnboardingPuckPreview
                businessName={businessName}
                businessType={businessType}
                logoDataUri={storeLogoDataUri || logoUrl}
                brandColors={parsedBrandColors}
                data={templateData}
                onEdit={(data) => {
                  setTemplateData(data);
                  setIsEditorOpen(true);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
