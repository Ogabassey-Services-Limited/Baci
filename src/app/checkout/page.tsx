
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, CreditCard, Loader2, Mail, Phone, User, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ThemedInput } from '@/components/themed';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { OrderSummary } from '@/components/order-summary';
import { MerchantProvider } from '@/hooks/use-merchant';
import { AddressAutocomplete } from '@/components/address-autocomplete';


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

function Step1_Shipping() {
  const { control } = useForm<ShippingFormValues>();
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
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
                        <ThemedInput placeholder="John" {...field} className="pl-10" />
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
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
                        <ThemedInput placeholder="Doe" {...field} className="pl-10" />
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
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
                <ThemedInput type="email" placeholder="you@example.com" {...field} className="pl-10" />
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
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
                <ThemedInput type="tel" placeholder="+1 (555) 123-4567" {...field} className="pl-10" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <AddressAutocomplete />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <ThemedInput placeholder="San Francisco" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State / Province</FormLabel>
              <FormControl>
                <ThemedInput placeholder="California" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
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
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const totalSteps = 2;

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    // Redirect if cart is empty after initial load
    if (cartCount === 0 && !isLoading) {
      router.replace('/');
    }
  }, [cartCount, isLoading, router]);
  
  // Render nothing or a loader while redirecting
  if (cartCount === 0 && !isLoading) {
    return null;
  }

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (isValid && step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const onSubmit = async (data: ShippingFormValues) => {
    setIsLoading(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("Order submitted:", {
        shipping: data,
        items: cart,
    });
    
    // In a real app, you would save the order to a database here
    
    toast({
      title: 'Payment Successful!',
      description: 'Your order has been placed.',
    });

    const orderData = { shipping: data, items: cart };
    // We'll store the order in sessionStorage to display on the success page
    sessionStorage.setItem('lastOrder', JSON.stringify(orderData));

    clearCart();
    setIsLoading(false);
    
    router.push('/checkout/success');
  };

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
                {step === 1 ? 'Shipping Information' : 'Payment'}
            </h2>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {step === 1 && <Step1_Shipping />}
                {step === 2 && <Step2_Payment />}

                <div className="flex justify-between pt-4">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={handlePrev}>
                      Previous
                    </Button>
                  )}
                  {step === 1 && <div />}

                  {step < totalSteps ? (
                    <Button type="button" onClick={handleNext}>
                      Continue to Payment
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLoading ? 'Processing...' : 'Place Order'}
                    </Button>
                  )}
                </div>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
        
        <div className="sticky top-24">
            <OrderSummary />
        </div>
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
