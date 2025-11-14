
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Loader2, Mail, Phone, User, Home, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ThemedInput, ThemedButton } from '@/components/themed';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { OrderSummary } from '@/components/order-summary';
import { useMerchant, MerchantProvider } from '@/hooks/use-merchant';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getCountryByCode } from '@/lib/countries';

const shippingSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  address: z.string().min(5, 'Please enter a valid address.'),
  city: z.string().min(2, 'Please enter a city.'),
  state: z.string().min(2, 'Please enter a state.'),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type AuthFormValues = z.infer<typeof authSchema>;

function Step0_Auth({ onAuthSuccess }: { onAuthSuccess: (user: SupabaseUser) => void }) {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();
    
    const form = useForm<AuthFormValues>({
        resolver: zodResolver(authSchema),
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = async (data: AuthFormValues) => {
        setIsLoading(true);
        try {
            if (isLogin) {
                const { data: authData, error } = await supabase.auth.signInWithPassword(data);
                if (error) throw error;
                if (authData.user) onAuthSuccess(authData.user);
            } else {
                const { data: authData, error } = await supabase.auth.signUp(data);
                if (error) throw error;
                if (authData.user) {
                    toast({ title: "Account created!", description: "Please check your email to verify your account." });
                    onAuthSuccess(authData.user);
                }
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: isLogin ? 'Sign-in Failed' : 'Sign-up Failed',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">{isLogin ? 'Sign in to continue' : 'Create an account'}</h3>
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <ThemedInput type="email" placeholder="you@example.com" {...field} className="pl-10" id="email" name="email" autoComplete="email" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <ThemedInput type="password" {...field} className="pl-10" id="password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <ThemedButton type="submit" colorRole="primary" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </ThemedButton>
                </form>
            </FormProvider>
            <p className="text-sm text-center text-muted-foreground">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="px-1">
                    {isLogin ? 'Sign Up' : 'Sign In'}
                </Button>
            </p>
        </div>
    );
}

function Step1_Shipping() {
  const { control } = useFormContext<ShippingFormValues>();
  const { merchant } = useMerchant();
  
  const country = merchant?.country ? getCountryByCode(merchant.country) : null;
  const phonePlaceholder = country?.phoneCode ? `${country.phoneCode} ...` : '+1 (555) 123-4567';


  return (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={control}
                name="firstName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <ThemedInput placeholder="John" {...field} className="pl-10" id="firstName" name="firstName" autoComplete="given-name" />
                    </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="lastName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Last Name (Surname)</FormLabel>
                    <FormControl>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <ThemedInput placeholder="Doe" {...field} className="pl-10" id="lastName" name="lastName" autoComplete="family-name" />
                    </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
       <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
               <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <ThemedInput type="email" placeholder="you@example.com" {...field} className="pl-10" id="shipping-email" name="shipping-email" autoComplete="email" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
       <FormField
        control={control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
                <div className="relative">
                    {country && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">{country.flag}</span>}
                    <ThemedInput type="tel" placeholder={phonePlaceholder} {...field} className="pl-12" id="phone" name="phone" autoComplete="tel" />
                </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <AddressAutocomplete />
       <FormField control={control} name="city" render={({ field }) => (<FormItem><FormControl><input type="hidden" {...field} /></FormControl></FormItem>)} />
       <FormField control={control} name="state" render={({ field }) => (<FormItem><FormControl><input type="hidden" {...field} /></FormControl></FormItem>)} />
    </div>
  );
}

function Step2_Payment() {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Payment Information</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div className="flex items-center gap-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">Pay with Card</p>
                        <p className="text-sm text-muted-foreground">
                            Click the button below to simulate payment.
                        </p>
                    </div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
                This is a demo. No real payment will be processed.
            </p>
        </div>
    );
}


function CheckoutPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { clearCart, cart, cartCount } = useCart();
  const [step, setStep] = useState(0); // 0: Auth, 1: Shipping, 2: Payment
  const [pageLoading, setPageLoading] = useState(true);
  const [formIsLoading, setFormIsLoading] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const totalSteps = 2;
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
            setUser(data.user);
            setStep(1); // User is logged in, skip to shipping
        }
        setPageLoading(false);
    };
    checkUser();
  }, [supabase.auth]);

  const shippingForm = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: user?.email || '',
      phone: '',
      address: '',
      city: '',
      state: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    // If user changes, reset email field
    if (user) {
        shippingForm.setValue('email', user.email || '');
    }
  }, [user, shippingForm]);

  useEffect(() => {
    // Redirect if cart is empty after initial load
    if (cartCount === 0 && !pageLoading) {
      router.replace('/');
    }
  }, [cartCount, pageLoading, router]);
  
  if (pageLoading) {
      return (
          <div className="flex flex-1 items-center justify-center h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  if (cartCount === 0) {
    return null;
  }

  const handleAuthSuccess = (authedUser: SupabaseUser) => {
    setUser(authedUser);
    setStep(1);
  }

  const handleNext = async () => {
    const isValid = await shippingForm.trigger();
    if (isValid && step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const onShippingSubmit = async (data: ShippingFormValues) => {
    setFormIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("Order submitted:", {
        shipping: data,
        items: cart,
        userId: user?.id,
    });
    
    toast({
      title: 'Payment Successful!',
      description: 'Your order has been placed.',
    });

    const orderData = { shipping: data, items: cart };
    sessionStorage.setItem('lastOrder', JSON.stringify(orderData));

    clearCart();
    setFormIsLoading(false);
    
    router.push('/checkout/success');
  };

  const getStepTitle = () => {
      if (step === 0) return 'Authentication';
      if (step === 1) return 'Shipping Information';
      return 'Payment';
  }

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </Link>
      
      <div className="grid md:grid-cols-[1fr_350px] gap-12 items-start">
        <Card>
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-6">
                {getStepTitle()}
            </h2>
                
            {formIsLoading && <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}

            {!formIsLoading && step === 0 && <Step0_Auth onAuthSuccess={handleAuthSuccess} />}
            
            {!formIsLoading && step === 1 && (
              <FormProvider {...shippingForm}>
                <form onSubmit={shippingForm.handleSubmit(onShippingSubmit)} className="space-y-6">
                  <Step1_Shipping />
                  <div className="flex justify-end pt-4">
                    <ThemedButton type="button" colorRole="primary" onClick={handleNext}>
                      Continue to Payment
                    </ThemedButton>
                  </div>
                </form>
              </FormProvider>
            )}

            {!formIsLoading && step === 2 && (
               <form onSubmit={shippingForm.handleSubmit(onShippingSubmit)} className="space-y-6">
                  <Step2_Payment />
                  <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={handlePrev}>
                        Previous
                      </Button>
                      <ThemedButton type="submit" colorRole="accent" disabled={formIsLoading}>
                          {formIsLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : 'Place Order' }
                      </ThemedButton>
                  </div>
                </form>
            )}
          </CardContent>
        </Card>
        <OrderSummary />
      </div>
    </div>
  );
}

export default function CheckoutPage() {
    return (
        <MerchantProvider>
            <CheckoutPageContent />
        </MerchantProvider>
    )
}
