
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard, User, Mail, KeyRound, ArrowLeft, Truck, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ThemedInput, ThemedButton } from '@/components/themed';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { useMerchant, MerchantProvider } from '@/hooks/use-merchant';
// 2025 Checkout Components
import {
  ShippingSelector,
  DiscountCodeInput,
  CheckoutProgress,
  DynamicOrderSummary,
  type ShippingQuote,
  type DiscountResult,
  type CheckoutStep,
} from '@/components/storefront/checkout';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useCurrency } from '@/hooks/use-currency';
import { apiPost } from '@/lib/api-client';
import { PhoneInput } from '@/components/ui/phone-input';
import { isValidPhoneNumber, type Country as CountryCode } from 'react-phone-number-input';
import { getCountryByCode } from '@/lib/countries';
import { trackEvent } from '@/lib/event-tracking';
import { trackServerSidePurchase, trackServerSideBeginCheckout } from '@/lib/server-side-analytics';
import { trackPlatformPurchase } from '@/components/analytics/platform-analytics-provider';

const DEFAULT_SHIPPING_FEE = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_SHIPPING_FEE ?? '10.00');

const shippingSchema = z.object({
  firstName: z.string().min(2, { error: 'First name must be at least 2 characters.' }),
  lastName: z.string().min(2, { error: 'Last name must be at least 2 characters.' }),
  email: z.string().email({ error: 'Please enter a valid email address.' }),
  phone: z.string().refine(isValidPhoneNumber, { message: 'Please enter a valid phone number.' }),
  address: z.string().min(5, { error: 'Please enter a valid address.' }),
  city: z.string().min(2, { error: 'Please enter a city.' }),
  state: z.string().min(2, { error: 'Please enter a state.' }),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

const authSchema = z.object({
  email: z.string().email({ error: 'Please enter a valid email address.' }),
  password: z.string().min(8, { error: 'Password must be at least 8 characters.' }),
}).superRefine(async (data, ctx) => {
  if (data.password && data.password.length >= 8) {
    // Check for common passwords first (instant, no network)
    const { isCommonPassword } = await import('@/lib/utils');
    if (isCommonPassword(data.password)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'This password is too common. Please choose a more unique password.'
      });
      return;
    }

    // Check for breached passwords during signup
    try {
      const { checkPasswordBreach } = await import('@/lib/password-breach');
      const { isBreached } = await checkPasswordBreach(data.password);
      if (isBreached) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'This password has been compromised in a data breach. Please choose a different password.'
        });
      }
    } catch (error) {
      console.error('Breach check failed:', error);
    }
  }
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
                    <ThemedInput
                      type="password"
                      {...field}
                      className="pl-10"
                      id="password"
                      name="password"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="off"
                      data-form-type="password"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <ThemedButton type="submit" colorRole="primary" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
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

function Step1_Shipping({
  onShippingSelect,
  selectedShippingQuote,
  shippingLoading,
}: {
  onShippingSelect: (quote: ShippingQuote) => void;
  selectedShippingQuote: ShippingQuote | null;
  shippingLoading: boolean;
}) {
  const { control, setValue, watch } = useFormContext<ShippingFormValues>();
  const { merchant } = useMerchant();
  const { cart, cartTotal: _cartTotal } = useCart();

  const country = merchant?.country ? getCountryByCode(merchant.country) : null;

  // Watch address fields for shipping quote
  const watchedFields = watch(['firstName', 'lastName', 'phone', 'address', 'city', 'state', 'email']);
  const [firstName, lastName, phone, address, city, state, email] = watchedFields;

  // Build receiver address for shipping selector
  const receiverAddress = {
    name: `${firstName || ''} ${lastName || ''}`.trim() || 'Customer',
    phone: phone || '',
    email: email,
    address: address || '',
    city: city || '',
    state: state || '',
    country: country?.name || 'Nigeria',
    countryCode: country?.code || 'NG',
  };

  // Build items for shipping quote
  const shippingItems = cart.map(item => ({
    name: item.name,
    quantity: item.quantity,
    weight: 1, // Default weight
    value: item.price * item.quantity,
  }));

  // Check if address is complete enough for shipping quotes
  const addressComplete = !!(address && city && state);

  return (
    <div className="space-y-6">
      {/* Contact & Address Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Contact Information
        </h4>
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
                <PhoneInput
                  placeholder="Enter phone number"
                  defaultCountry={(country?.code as CountryCode) || 'NG'}
                  value={field.value}
                  onChange={field.onChange}
                  id="phone"
                  autoComplete="tel"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Delivery Address Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Delivery Address
        </h4>
        <FormField
          control={control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <AddressAutocomplete
                  {...field}
                  useThemedInput={true}
                  showIcon={true}
                  country={country?.code}
                  onChange={(val) => field.onChange(val)}
                  onSelect={(place) => {
                    field.onChange(place.formattedAddress);
                    setValue('city', place.city);
                    setValue('state', place.state);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField control={control} name="city" render={({ field }) => (<FormItem><FormControl><input type="hidden" {...field} /></FormControl></FormItem>)} />
        <FormField control={control} name="state" render={({ field }) => (<FormItem><FormControl><input type="hidden" {...field} /></FormControl></FormItem>)} />
      </div>

      {/* Shipping Options - 2025 Best Practice: Cheapest/Fastest tabs with delivery dates */}
      {addressComplete && (
        <ShippingSelector
          receiverAddress={receiverAddress}
          items={shippingItems}
          onSelect={onShippingSelect}
          selectedQuoteId={selectedShippingQuote?.id}
          isLoading={shippingLoading}
          className="pt-2"
        />
      )}
    </div>
  );
}

function Step2_Payment({
  selectedShippingQuote,
  appliedDiscount: _appliedDiscount,
  onDiscountApply,
  merchantId,
  cartTotal,
  customerEmail,
  productIds,
}: {
  selectedShippingQuote: ShippingQuote | null;
  appliedDiscount: DiscountResult | null;
  onDiscountApply: (discount: DiscountResult | null) => void;
  merchantId: string;
  cartTotal: number;
  customerEmail?: string;
  productIds?: string[];
}) {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-6">
      {/* Selected Shipping Summary */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Delivery Method
        </h4>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {selectedShippingQuote?.carrierName || selectedShippingQuote?.displayName || 'Standard Shipping'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedShippingQuote?.estimatedDays
                    ? `Est. ${selectedShippingQuote.estimatedDays} business days`
                    : 'Est. 3-5 business days'}
                </p>
              </div>
            </div>
            <p className="font-semibold">
              {selectedShippingQuote ? formatCurrency(selectedShippingQuote.price) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discount Code - 2025 Best Practice: Strategic placement, collapsible */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Discount
        </h4>
        <DiscountCodeInput
          merchantId={merchantId}
          orderTotal={cartTotal}
          customerEmail={customerEmail}
          productIds={productIds}
          onApply={onDiscountApply}
        />
      </div>

      {/* Payment Method */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Payment Method
        </h4>
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Pay with Card</p>
                <p className="text-sm text-muted-foreground">
                  Secure payment via Korapay
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>🔒</span>
                <span>Secure</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">🔒 SSL Encrypted</span>
        <span className="flex items-center gap-1">💳 Safe Payment</span>
        <span className="flex items-center gap-1">📦 Tracked Delivery</span>
      </div>
    </div>
  );
}


function CheckoutPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { clearCart, cart, cartCount, cartTotal } = useCart();
  const { merchant } = useMerchant();
  const { currencyCode } = useCurrency();
  const [step, setStep] = useState(0); // 0: Auth, 1: Shipping, 2: Payment
  const [pageLoading, setPageLoading] = useState(true);
  const [formIsLoading, setFormIsLoading] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [shippingFee, setShippingFee] = useState<number | null>(null);

  // 2025 Checkout: Enhanced state for shipping and discounts
  const [selectedShippingQuote, setSelectedShippingQuote] = useState<ShippingQuote | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountResult | null>(null);
  const [shippingLoading, _setShippingLoading] = useState(false);

  const totalSteps = 2;
  const supabase = createClient();

  // Product IDs for discount validation
  const productIds = cart.map(item => item.id);

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
    // If user changes, autofill email and name fields from user metadata
    if (user) {
      shippingForm.setValue('email', user.email || '');

      // Autofill name fields from user metadata if available
      const metadata = user.user_metadata;
      if (metadata) {
        if (metadata.first_name) {
          shippingForm.setValue('firstName', metadata.first_name);
        } else if (metadata.full_name) {
          // Try to split full_name if first_name is not available
          const nameParts = metadata.full_name.split(' ');
          if (nameParts.length > 0) {
            shippingForm.setValue('firstName', nameParts[0]);
            if (nameParts.length > 1) {
              shippingForm.setValue('lastName', nameParts.slice(1).join(' '));
            }
          }
        }

        if (metadata.last_name) {
          shippingForm.setValue('lastName', metadata.last_name);
        }
      }
    }
  }, [user, shippingForm]);

  useEffect(() => {
    // Redirect if cart is empty after initial load
    if (cartCount === 0 && !pageLoading) {
      router.replace('/');
    }
  }, [cartCount, pageLoading, router]);


  // Handle shipping quote selection (from ShippingSelector component)
  const handleShippingSelect = (quote: ShippingQuote) => {
    setSelectedShippingQuote(quote);
    setShippingFee(quote.price);
  };

  // Handle discount code application
  const handleDiscountApply = (discount: DiscountResult | null) => {
    setAppliedDiscount(discount);
  };

  // Calculate final total with discount
  const _calculateFinalTotal = () => {
    const shipping = selectedShippingQuote?.price ?? shippingFee ?? DEFAULT_SHIPPING_FEE;
    const discount = appliedDiscount?.discountAmount ?? 0;
    return Math.max(0, cartTotal + shipping - discount);
  };

  const handleAuthSuccess = (authedUser: SupabaseUser) => {
    setUser(authedUser);
    setStep(1);
  };

  const handleNext = async () => {
    const isValid = await shippingForm.trigger();

    // 2025 Best Practice: Require shipping selection before proceeding
    if (step === 1 && !selectedShippingQuote) {
      toast({
        title: "Select Shipping",
        description: "Please select a delivery option to continue.",
        variant: "destructive",
      });
      return;
    }

    if (isValid && step < totalSteps) {
      // Track begin_checkout when moving to payment step
      if (step === 1 && merchant?.id) {
        // Client-side tracking
        trackEvent.beginCheckout(
          merchant.id,
          cart.map(item => ({ product: item, quantity: item.quantity })),
          'NGN' // Default currency for Nigeria
        );

        // Server-side tracking for GA4, Facebook, TikTok, Snapchat
        trackServerSideBeginCheckout(
          merchant.id,
          cartTotal,
          'NGN',
          cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category,
          })),
          undefined,
          { eventSourceUrl: window.location.href }
        ).catch(err => {
          console.warn('Server-side analytics error:', err);
        });
      }
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

    try {
      // Get merchant ID from Supabase
      if (!merchant || !merchant.id) {
        throw new Error('Merchant information not available. Please try again.');
      }

      // Fetch merchant ID from database
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('id, shipping_fee')
        .eq('id', merchant.id)
        .single();

      if (merchantError || !merchantData) {
        throw new Error('Unable to find store information. Please try again.');
      }

      // Prepare order items
      const orderItems = cart.map(item => ({
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));

      // Calculate totals - 2025: Use selected shipping quote and discount
      const subtotal = cartTotal;
      const finalShippingFee = selectedShippingQuote?.price ?? shippingFee ?? merchantData.shipping_fee ?? DEFAULT_SHIPPING_FEE;
      const discountAmount = appliedDiscount?.discountAmount ?? 0;
      const finalTotal = Math.max(0, subtotal + finalShippingFee - discountAmount);

      // Create order via API - 2025: Include shipping provider details and discount
      const { order } = await apiPost<{ order: Record<string, unknown> }>('/api/orders', {
        merchant_id: merchantData.id,
        customer_email: data.email,
        customer_name: `${data.firstName} ${data.lastName}`,
        customer_phone: data.phone,
        items: orderItems,
        subtotal,
        shipping_fee: finalShippingFee,
        // 2025: Discount information
        discount_code_id: appliedDiscount?.id,
        discount_code: appliedDiscount?.code,
        discount_amount: discountAmount,
        // Final total after discount
        total: finalTotal,
        payment_method: 'card',
        payment_status: 'paid', // Since this is a demo, mark as paid
        shipping_status: 'pending',
        shipping_address: {
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          city: data.city,
          state: data.state,
        },
        source: 'online_store',
        // 2025: Detailed shipping provider info
        shipping_provider: selectedShippingQuote?.provider || 'GIGL',
        shipping_quote_id: selectedShippingQuote?.id,
        shipping_carrier: selectedShippingQuote?.carrierName,
        shipping_service_tier: selectedShippingQuote?.serviceTier,
        estimated_delivery_days: selectedShippingQuote?.estimatedDays,
      });

      // Store order data for success page - 2025: Include all details
      const orderData = {
        order_id: order.id,
        order_number: order.order_number,
        shipping: data,
        items: cart,
        subtotal,
        shipping_fee: finalShippingFee,
        discount_code: appliedDiscount?.code,
        discount_amount: discountAmount,
        total: finalTotal,
        shipping_provider: selectedShippingQuote?.carrierName || selectedShippingQuote?.provider,
        estimated_delivery_days: selectedShippingQuote?.estimatedDays,
      };
      sessionStorage.setItem('lastOrder', JSON.stringify(orderData));

      // Track purchase event for merchant analytics (client-side + internal)
      if (merchant?.id) {
        trackEvent.purchase(
          merchant.id,
          order.order_number as string,
          cart.map(item => ({ product: item, quantity: item.quantity })),
          order.total as number,
          'NGN', // Default currency for Nigeria
          finalShippingFee,
          0 // No tax in this system
        );

        // Server-side tracking for GA4, Facebook, TikTok, Snapchat
        // This bypasses ad blockers and provides more accurate attribution
        trackServerSidePurchase(
          merchant.id,
          order.order_number as string,
          order.total as number,
          'NGN',
          cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category,
          })),
          {
            email: data.email,
            phone: data.phone,
            firstName: data.firstName,
            lastName: data.lastName,
            city: data.city,
            state: data.state,
          },
          { eventSourceUrl: window.location.href }
        ).catch(err => {
          // Don't block checkout on analytics errors
          console.warn('Server-side analytics error:', err);
        });

        // Track platform-level purchase (for platform owner's analytics)
        trackPlatformPurchase(
          merchant.id,
          order.total as number,
          currencyCode,
          order.order_number as string
        );
      }

      toast({
        title: 'Payment Successful!',
        description: `Order ${order.order_number} has been placed.`,
      });

      clearCart();
      router.push('/checkout/success');
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: (error as Error).message || 'Failed to create order. Please try again.',
      });
    } finally {
      setFormIsLoading(false);
    }
  };

  // Map step number to CheckoutStep type for progress indicator
  const getCurrentCheckoutStep = (): CheckoutStep => {
    if (step === 1) return 'shipping';
    if (step === 2) return 'payment';
    return 'shipping';
  };

  const getStepTitle = () => {
    if (step === 0) return 'Sign In';
    if (step === 1) return 'Shipping & Delivery';
    return 'Review & Pay';
  };

  // Check if place order button should be enabled
  const canPlaceOrder = !formIsLoading && selectedShippingQuote !== null;

  return (
    <>
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="container mx-auto max-w-5xl py-8 px-4"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {/* Header with back link */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Store
          </Link>
          <h1 className="text-xl font-semibold">Checkout</h1>
        </div>

        {/* 2025 Best Practice: Progress indicator with verbs */}
        {step > 0 && (
          <CheckoutProgress
            currentStep={getCurrentCheckoutStep()}
            onStepClick={(clickedStep) => {
              if (clickedStep === 'shipping' && step > 1) setStep(1);
            }}
            className="mb-8"
          />
        )}

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
          {/* Main checkout form */}
          <Card className="glass">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                {step === 0 && <UserCircle className="h-6 w-6" />}
                {step === 1 && <Truck className="h-6 w-6" />}
                {step === 2 && <CreditCard className="h-6 w-6" />}
                {getStepTitle()}
              </h2>

              {/* Step 0: Authentication */}
              {step === 0 && <Step0_Auth onAuthSuccess={handleAuthSuccess} />}

              {/* Step 1: Shipping - 2025: With integrated shipping selector */}
              {step === 1 && (
                <FormProvider {...shippingForm}>
                  <form onSubmit={shippingForm.handleSubmit(onShippingSubmit)} className="space-y-6">
                    <Step1_Shipping
                      onShippingSelect={handleShippingSelect}
                      selectedShippingQuote={selectedShippingQuote}
                      shippingLoading={shippingLoading}
                    />
                    <div className="flex justify-end pt-4 border-t">
                      <ThemedButton
                        type="button"
                        colorRole="primary"
                        onClick={handleNext}
                        disabled={!selectedShippingQuote}
                        className="min-w-[180px]"
                      >
                        Continue to Payment
                      </ThemedButton>
                    </div>
                  </form>
                </FormProvider>
              )}

              {/* Step 2: Payment - 2025: With discount code and payment method */}
              {step === 2 && (
                <form onSubmit={shippingForm.handleSubmit(onShippingSubmit)} className="space-y-6">
                  <Step2_Payment
                    selectedShippingQuote={selectedShippingQuote}
                    appliedDiscount={appliedDiscount}
                    onDiscountApply={handleDiscountApply}
                    merchantId={merchant?.id || ''}
                    cartTotal={cartTotal}
                    customerEmail={shippingForm.getValues('email')}
                    productIds={productIds}
                  />
                  <div className="flex justify-between pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handlePrev}>
                      Back
                    </Button>
                    <ThemedButton
                      type="submit"
                      colorRole="accent"
                      disabled={!canPlaceOrder}
                      className="min-w-[180px]"
                    >
                      {formIsLoading && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
                      Place Order
                    </ThemedButton>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* 2025 Best Practice: Dynamic Order Summary with real-time updates */}
          <DynamicOrderSummary
            subtotal={cartTotal}
            shippingQuote={selectedShippingQuote}
            discount={appliedDiscount}
            currencyCode={currencyCode}
            shippingLoading={shippingLoading}
          />
        </div>
      </main>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <MerchantProvider>
      <CheckoutPageContent />
    </MerchantProvider>
  );
}
