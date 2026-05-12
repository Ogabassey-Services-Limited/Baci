'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Mail,
  Sparkles,
  Truck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import {
  type Country as CountryCode,
  isValidPhoneNumber,
} from 'react-phone-number-input';
import z from 'zod';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { trackPlatformPurchase } from '@/components/analytics/platform-analytics-provider';
import { CheckoutThemeProvider } from '@/components/checkout-theme-provider';
import { OrderSummary } from '@/components/order-summary';
import { CheckoutProgress } from '@/components/storefront/checkout/checkout-progress';
import { DiscountCodeInput } from '@/components/storefront/checkout/discount-code-input';
import {
  SelectedShippingDisplay,
  ShippingOptions,
} from '@/components/storefront/checkout/shipping-options';
import { ThemedButton, ThemedInput } from '@/components/themed';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PhoneInput } from '@/components/ui/phone-input';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import { buildCheckoutOrderItems } from '@/lib/checkout/build-order-items';
import { getCountryByCode } from '@/lib/countries';
import { trackEvent } from '@/lib/event-tracking';
import { trackServerSideBeginCheckout } from '@/lib/server-side-analytics';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_SHIPPING_FEE = Number.parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_SHIPPING_FEE ?? '10.00'
);

const shippingSchema = z.object({
  firstName: z
    .string()
    .min(2, { message: 'First name must be at least 2 characters.' }),
  lastName: z
    .string()
    .min(2, { message: 'Last name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().refine(isValidPhoneNumber, {
    message: 'Please enter a valid phone number.',
  }),
  address: z.string().min(5, { message: 'Please enter a valid address.' }),
  city: z.string().min(2, { message: 'Please enter a city.' }),
  state: z.string().min(2, { message: 'Please enter a state.' }),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

// OTP Auth schema for customer authentication
const otpAuthSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type OtpAuthFormValues = z.infer<typeof otpAuthSchema>;

// Customer data interface for pre-filling form
interface CustomerData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  saved_addresses?: Array<{
    first_name: string;
    last_name: string;
    full_name?: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    is_default?: boolean;
  }>;
}

function Step0_Auth({
  onAuthSuccess,
  onGuestCheckout,
  merchantSlug,
}: {
  onAuthSuccess: (user: SupabaseUser, customerData?: CustomerData) => void;
  onGuestCheckout: () => void;
  merchantSlug: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<OtpAuthFormValues>({
    resolver: zodResolver(otpAuthSchema),
    defaultValues: { email: '' },
  });

  // Send OTP code
  const handleSendOtp = async (data: OtpAuthFormValues) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/storefront/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, merchantSlug }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send code');
      }

      setEmail(data.email);
      setOtpSent(true);
      toast({
        title: 'Code sent!',
        description: 'Check your email for the 6-digit verification code.',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...otpCode];
    newCode[index] = value;
    setOtpCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      handleVerifyOtp(newCode.join(''));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...otpCode];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i];
    }
    setOtpCode(newCode);

    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      handleVerifyOtp(newCode.join(''));
    }
  };

  // Verify OTP code
  const handleVerifyOtp = async (code: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/storefront/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code, merchantSlug }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      // Get user from Supabase client (session should be set)
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        onAuthSuccess(userData.user, result.customer);
      } else {
        throw new Error('Authentication failed. Please try again.');
      }
    } catch (err) {
      setError((err as Error).message);
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!otpSent ? (
        // Email input form
        <>
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium">Sign in to checkout</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We'll send you a verification code - no password needed
            </p>
          </div>

          <FormProvider {...form}>
            <form
              onSubmit={form.handleSubmit(handleSendOtp)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <ThemedInput
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className="pl-10"
                          id="email"
                          name="email"
                          autoComplete="email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <ThemedButton
                type="submit"
                colorRole="primary"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                )}
                Continue with email
              </ThemedButton>
            </form>
          </FormProvider>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={onGuestCheckout}
          >
            Continue as guest
          </Button>
        </>
      ) : (
        // OTP verification form
        <>
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium">Enter verification code</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to {email}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
              {otpCode.map((digit, index) => (
                <input
                  // biome-ignore lint/suspicious/noArrayIndexKey: OTP inputs are fixed-size array (6 digits) that never reorders
                  key={index}
                  ref={(el) => {
                    otpInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-mono border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                  disabled={isLoading}
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </div>
            )}

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSendOtp({ email })}
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Resend code'}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setOtpSent(false);
                setOtpCode(['', '', '', '', '', '']);
                setError('');
              }}
            >
              Use a different email
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface ShippingQuote {
  id: string;
  provider: 'GIGL' | 'TOPSHIP';
  serviceTier: string;
  carrierName: string;
  displayName: string;
  estimatedDays: number;
  minDays?: number;
  maxDays?: number;
  price: number;
  currency: string;
  pickupIncluded: boolean;
  insuranceIncluded: boolean;
  isStationPickup?: boolean;
  stationName?: string;
  stationAddress?: string;
  providerRateId?: string;
}

function Step1_Shipping({
  onShippingSelect,
  selectedQuote,
}: {
  onShippingSelect: (quote: ShippingQuote, sessionId: string) => void;
  selectedQuote: ShippingQuote | null;
}) {
  const { control, setValue } = useFormContext<ShippingFormValues>();
  const { merchant } = useMerchant();
  const { cart } = useCart();

  const country = merchant?.country ? getCountryByCode(merchant.country) : null;
  const isNigerian = country?.code === 'NG' || !country;

  // Use useWatch instead of watch - watch doesn't trigger re-renders in nested components!
  const watchCity = useWatch({ control, name: 'city' });
  const watchState = useWatch({ control, name: 'state' });
  const watchAddress = useWatch({ control, name: 'address' });
  const watchPhone = useWatch({ control, name: 'phone' });
  const watchFirstName = useWatch({ control, name: 'firstName' });
  const watchLastName = useWatch({ control, name: 'lastName' });

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
                  <ThemedInput
                    placeholder="John"
                    {...field}
                    className="pl-10"
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                  />
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
                  <ThemedInput
                    placeholder="Doe"
                    {...field}
                    className="pl-10"
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                  />
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
                <ThemedInput
                  type="email"
                  placeholder="you@example.com"
                  {...field}
                  className="pl-10"
                  id="shipping-email"
                  name="shipping-email"
                  autoComplete="email"
                />
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
                limitMaxLength={true}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Address Input - Use Nigerian autocomplete for Nigerian merchants */}
      <FormField
        control={control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Delivery Address</FormLabel>
            <FormControl>
              <AddressAutocomplete
                {...field}
                useThemedInput={true}
                showIcon={true}
                placeholder="Enter your full address"
                country={country?.code}
                onChange={(val) => field.onChange(val)}
                onSelect={(place) => {
                  field.onChange(place.formattedAddress);
                  // If Google Maps returns Lagos as both city and state, clear city to force user input
                  if (place.city === 'Lagos' && place.state === 'Lagos') {
                    setValue('city', '', {
                      shouldValidate: false,
                      shouldDirty: true,
                    });
                  } else {
                    setValue('city', place.city, {
                      shouldValidate: false,
                      shouldDirty: true,
                    });
                  }
                  setValue('state', place.state, {
                    shouldValidate: false,
                    shouldDirty: true,
                  });
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* City and State - Auto-filled from address but editable */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <ThemedInput
                  placeholder="e.g. Ikeja, Lekki, Yaba"
                  autoComplete="new-password"
                  {...field}
                />
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
              <FormLabel>State</FormLabel>
              <FormControl>
                <ThemedInput
                  placeholder="e.g. Lagos"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Shipping Options - Show when address is complete */}
      {watchCity && watchState && isNigerian && (
        <div className="pt-4 border-t">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipping Options
          </h3>
          <ShippingOptions
            receiverCity={watchCity}
            receiverState={watchState}
            receiverAddress={watchAddress}
            receiverPhone={watchPhone}
            receiverName={`${watchFirstName} ${watchLastName}`}
            cartItems={cart.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            }))}
            onSelect={onShippingSelect}
            selectedQuoteId={selectedQuote?.id}
          />
        </div>
      )}
    </div>
  );
}

interface PaymentGatewaySettings {
  paystackEnabled: boolean;
  korapayEnabled: boolean;
  payOnDeliveryEnabled: boolean;
  creditDirectEnabled: boolean;
  creditDirectMinAmount: number;
  creditDirectMaxAmount: number;
  preferredLocalGateway: 'paystack' | 'korapay';
  preferredInternationalGateway: 'paystack' | 'korapay';
}

function Step2_Payment({
  selectedQuote,
  paymentSettings,
  selectedGateway,
  onGatewaySelect,
  orderTotal,
}: {
  selectedQuote: ShippingQuote | null;
  paymentSettings: PaymentGatewaySettings;
  selectedGateway: 'paystack' | 'korapay' | 'pod' | 'credit_direct';
  onGatewaySelect: (
    gateway: 'paystack' | 'korapay' | 'pod' | 'credit_direct'
  ) => void;
  orderTotal: number;
}) {
  const availableGateways: Array<{
    id: 'paystack' | 'korapay' | 'pod' | 'credit_direct';
    name: string;
    description: string;
    features: string[];
    color: string;
  }> = [];

  if (paymentSettings.paystackEnabled) {
    availableGateways.push({
      id: 'paystack',
      name: 'Paystack',
      description: 'Cards, Bank Transfer, USSD',
      features: ['Visa/Mastercard', 'Bank Transfer', 'USSD'],
      color: '#00C3F7',
    });
  }

  if (paymentSettings.korapayEnabled) {
    availableGateways.push({
      id: 'korapay',
      name: 'Korapay',
      description: 'Multi-currency payments',
      features: ['Cards', 'Bank Transfer', 'Mobile Money'],
      color: '#6366F1',
    });
  }

  if (paymentSettings.payOnDeliveryEnabled) {
    availableGateways.push({
      id: 'pod',
      name: 'Pay on Delivery',
      description: 'Pay when you receive your order',
      features: ['Cash', 'Transfer on Delivery'],
      color: '#10B981',
    });
  }

  // Credit Direct BNPL - only show if enabled and order amount is within limits
  const isCreditDirectEligible =
    paymentSettings.creditDirectEnabled &&
    orderTotal >= paymentSettings.creditDirectMinAmount &&
    orderTotal <= paymentSettings.creditDirectMaxAmount;

  if (isCreditDirectEligible) {
    availableGateways.push({
      id: 'credit_direct',
      name: 'Pay Later with Credit Direct',
      description: 'Split payment into easy installments',
      features: ['No Interest', 'Instant Approval', 'Flexible Payments'],
      color: '#7C3AED',
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Shipping & Payment</h3>
      <SelectedShippingDisplay quote={selectedQuote} />

      {availableGateways.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select payment method:
          </p>
          {availableGateways.map((gateway) => (
            <button
              key={gateway.id}
              type="button"
              onClick={() => onGatewaySelect(gateway.id)}
              className={`w-full rounded-lg border p-4 text-left transition-all ${
                selectedGateway === gateway.id
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-sm"
                  style={{ backgroundColor: gateway.color }}
                >
                  {gateway.id === 'paystack'
                    ? 'PS'
                    : gateway.id === 'korapay'
                      ? 'KP'
                      : gateway.id === 'credit_direct'
                        ? 'CD'
                        : 'POD'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{gateway.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {gateway.description}
                  </p>
                </div>
                {selectedGateway === gateway.id && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {gateway.features.map((feature) => (
                  <span
                    key={feature}
                    className="text-xs bg-muted px-2 py-0.5 rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No payment methods available</p>
              <p className="text-sm text-muted-foreground">
                Please contact the store owner.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Discount type for checkout
interface DiscountResult {
  valid: boolean;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  description?: string;
}

const DEFAULT_PAYMENT_SETTINGS: PaymentGatewaySettings = {
  paystackEnabled: true,
  korapayEnabled: true,
  payOnDeliveryEnabled: false,
  creditDirectEnabled: false,
  creditDirectMinAmount: 10000,
  creditDirectMaxAmount: 500000,
  preferredLocalGateway: 'paystack',
  preferredInternationalGateway: 'korapay',
};

function CheckoutPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { clearCart, cart, cartCount, cartTotal, merchantSlug } = useCart();
  const { merchant, basePath } = useMerchant();
  const { currencyCode } = useCurrency();
  const [step, setStep] = useState(0); // 0: Auth, 1: Shipping, 2: Payment
  const [pageLoading, setPageLoading] = useState(true);
  const [formIsLoading, setFormIsLoading] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [_isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [selectedShippingQuote, setSelectedShippingQuote] =
    useState<ShippingQuote | null>(null);
  const [shippingSessionId, setShippingSessionId] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountResult | null>(
    null
  );
  const [paymentSettings, setPaymentSettings] =
    useState<PaymentGatewaySettings>(DEFAULT_PAYMENT_SETTINGS);
  const [selectedGateway, setSelectedGateway] = useState<
    'paystack' | 'korapay' | 'pod' | 'credit_direct'
  >('paystack');
  const [creditDirectScriptLoaded, setCreditDirectScriptLoaded] =
    useState(false);
  const totalSteps = 2;
  const supabase = createClient();

  // Load Credit Direct script when BNPL is enabled
  useEffect(() => {
    if (paymentSettings.creditDirectEnabled && !creditDirectScriptLoaded) {
      const existingScript = document.querySelector(
        'script[src="https://checkout.creditdirect.ng/bnpl/checkout.min.js"]'
      );
      if (existingScript) {
        setCreditDirectScriptLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.creditdirect.ng/bnpl/checkout.min.js';
      script.type = 'application/javascript';
      script.async = true;
      script.onload = () => setCreditDirectScriptLoaded(true);
      script.onerror = () =>
        console.error('Failed to load Credit Direct checkout script');
      document.body.appendChild(script);
    }
  }, [paymentSettings.creditDirectEnabled, creditDirectScriptLoaded]);

  // Handle shipping quote selection
  const handleShippingSelect = (quote: ShippingQuote, sessionId: string) => {
    setSelectedShippingQuote(quote);
    setShippingSessionId(sessionId);
    setShippingFee(quote.price);
  };

  // Calculate discount amount
  const discountAmount = appliedDiscount
    ? appliedDiscount.discount_type === 'percentage'
      ? Math.round(cartTotal * (appliedDiscount.discount_value / 100))
      : Math.min(appliedDiscount.discount_value, cartTotal)
    : 0;

  // Calculate loyalty points (1 point per 100 NGN spent)
  const _loyaltyPointsEarned = Math.floor((cartTotal - discountAmount) / 100);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);

        // Also fetch customer data for this merchant if logged in
        if (merchantSlug) {
          try {
            const response = await fetch(
              `/api/storefront/auth/session?merchantSlug=${encodeURIComponent(merchantSlug)}`
            );
            const sessionData = await response.json();
            if (sessionData.authenticated && sessionData.customer) {
              setCustomerData(sessionData.customer);
            }
          } catch (err) {
            console.error('Failed to fetch customer data:', err);
          }
        }

        setStep(1); // User is logged in, skip to shipping
      }
      setPageLoading(false);
    };
    checkUser();
  }, [supabase.auth, merchantSlug]);

  // Fetch payment gateway settings
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      if (!merchant?.id) return;

      try {
        const response = await fetch(
          `/api/storefront/features?merchantId=${merchant.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setPaymentSettings({
            paystackEnabled: data.paystackEnabled ?? true,
            korapayEnabled: data.korapayEnabled ?? true,
            payOnDeliveryEnabled: data.payOnDeliveryEnabled ?? false,
            creditDirectEnabled: data.creditDirectEnabled ?? false,
            creditDirectMinAmount: data.creditDirectMinAmount ?? 10000,
            creditDirectMaxAmount: data.creditDirectMaxAmount ?? 500000,
            preferredLocalGateway: data.preferredLocalGateway || 'paystack',
            preferredInternationalGateway:
              data.preferredInternationalGateway || 'korapay',
          });
          // Set initial selected gateway based on preference
          const preferred = data.preferredLocalGateway || 'paystack';
          if (
            (preferred === 'paystack' && data.paystackEnabled) ||
            (preferred === 'korapay' && data.korapayEnabled)
          ) {
            setSelectedGateway(preferred);
          } else if (data.paystackEnabled) {
            setSelectedGateway('paystack');
          } else if (data.korapayEnabled) {
            setSelectedGateway('korapay');
          } else if (data.payOnDeliveryEnabled) {
            setSelectedGateway('pod');
          }
        }
      } catch (error) {
        console.error('Failed to fetch payment settings:', error);
      }
    };

    fetchPaymentSettings();
  }, [merchant?.id]);

  const shippingForm = useForm<z.infer<typeof shippingSchema>>({
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
    mode: 'onSubmit', // Only validate on submit - best practice for checkout
  });

  useEffect(() => {
    // If user changes, autofill email and name fields from user metadata or customer data
    if (user) {
      shippingForm.setValue('email', user.email || '', {
        shouldValidate: true,
        shouldDirty: true,
      });

      // First, try to fill from customer data (more up-to-date)
      if (customerData) {
        if (customerData.first_name) {
          shippingForm.setValue('firstName', customerData.first_name, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
        if (customerData.last_name) {
          shippingForm.setValue('lastName', customerData.last_name, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
        if (customerData.phone) {
          shippingForm.setValue('phone', customerData.phone, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }

        // Use default saved address if available
        const defaultAddress = customerData.saved_addresses?.find(
          (a) => a.is_default
        );
        if (defaultAddress) {
          shippingForm.setValue('address', defaultAddress.address, {
            shouldValidate: true,
            shouldDirty: true,
          });
          shippingForm.setValue('city', defaultAddress.city, {
            shouldValidate: true,
            shouldDirty: true,
          });
          shippingForm.setValue('state', defaultAddress.state, {
            shouldValidate: true,
            shouldDirty: true,
          });
          if (defaultAddress.phone) {
            shippingForm.setValue('phone', defaultAddress.phone, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
          // Override name with address name if different
          if (defaultAddress.full_name) {
            const nameParts = defaultAddress.full_name.split(' ');
            if (nameParts.length > 0) {
              shippingForm.setValue('firstName', nameParts[0], {
                shouldValidate: true,
                shouldDirty: true,
              });
              if (nameParts.length > 1) {
                shippingForm.setValue(
                  'lastName',
                  nameParts.slice(1).join(' '),
                  { shouldValidate: true, shouldDirty: true }
                );
              }
            }
          }
        }
      } else {
        // Fall back to user metadata
        const metadata = user.user_metadata;
        if (metadata) {
          if (metadata.first_name) {
            shippingForm.setValue('firstName', metadata.first_name, {
              shouldValidate: true,
              shouldDirty: true,
            });
          } else if (metadata.full_name) {
            // Try to split full_name if first_name is not available
            const nameParts = metadata.full_name.split(' ');
            if (nameParts.length > 0) {
              shippingForm.setValue('firstName', nameParts[0], {
                shouldValidate: true,
                shouldDirty: true,
              });
              if (nameParts.length > 1) {
                shippingForm.setValue(
                  'lastName',
                  nameParts.slice(1).join(' '),
                  { shouldValidate: true, shouldDirty: true }
                );
              }
            }
          } else if (metadata.name) {
            const parts = metadata.name.split(' ');
            shippingForm.setValue('firstName', parts[0] || '', {
              shouldValidate: true,
              shouldDirty: true,
            });
            shippingForm.setValue('lastName', parts.slice(1).join(' ') || '', {
              shouldValidate: true,
              shouldDirty: true,
            });
          }

          if (metadata.last_name) {
            shippingForm.setValue('lastName', metadata.last_name, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        }
      }
    }
  }, [user, customerData, shippingForm]);

  useEffect(() => {
    // Redirect if cart is empty after initial load
    if (cartCount === 0 && !pageLoading) {
      router.replace('/');
    }
  }, [cartCount, pageLoading, router]);

  const handleAuthSuccess = (
    authedUser: SupabaseUser,
    customer?: CustomerData
  ) => {
    setUser(authedUser);
    if (customer) {
      setCustomerData(customer);
    }
    setIsGuestCheckout(false);
    setStep(1);
  };

  const handleGuestCheckout = () => {
    setIsGuestCheckout(true);
    setStep(1);
  };

  const handleNext = async () => {
    const isValid = await shippingForm.trigger();

    // Check if shipping is selected for step 1
    if (step === 1 && !selectedShippingQuote) {
      toast({
        variant: 'destructive',
        title: 'Shipping Required',
        description: 'Please select a shipping option to continue.',
      });
      return;
    }

    if (isValid && step < totalSteps) {
      // Track begin_checkout when moving to payment step
      if (step === 1 && merchant?.id) {
        // Client-side tracking
        trackEvent.beginCheckout(
          merchant.id,
          cart.map((item) => ({ product: item, quantity: item.quantity })),
          'NGN' // Default currency for Nigeria
        );

        // Server-side tracking for GA4, Facebook, TikTok, Snapchat
        trackServerSideBeginCheckout(
          merchant.id,
          cartTotal,
          'NGN',
          cart.map((item) => {
            const itemCategory =
              item.categories?.name || item.category || 'General';
            return {
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              category: itemCategory,
            };
          }),
          undefined,
          { eventSourceUrl: window.location.href }
        ).catch((err) => {
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
      // Get merchant ID from context (useMerchant hook)
      if (!merchant?.id) {
        throw new Error(
          'Merchant information not available. Please refresh the page and try again.'
        );
      }

      // Prepare order items
      const orderItems = buildCheckoutOrderItems(cart);

      // Calculate totals - use merchant data from hook directly (no need to query DB again)
      const subtotal = cartTotal;
      const finalShippingFee = shippingFee ?? DEFAULT_SHIPPING_FEE;

      // Create order via API
      const { order, paystackAuthUrl } = await apiPost<{
        order: Record<string, unknown>;
        paystackAuthUrl?: string;
      }>('/api/orders', {
        merchant_id: merchant.id,
        customer_email: data.email,
        customer_name: `${data.firstName} ${data.lastName}`,
        customer_phone: data.phone,
        items: orderItems,
        subtotal,
        shipping_fee: finalShippingFee,
        payment_method: selectedGateway,
        payment_status: 'unpaid', // Order starts unpaid, changes to pending when payment initiated, then paid on confirmation
        shipping_status: 'pending',
        shipping_address: {
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          city: data.city,
          state: data.state,
        },
        source: 'online_store',
        // B3 (plan §5 B3): no silent fallback to 'GIGL' — if there's
        // no selected quote, send shipping_provider: null so the RPC's
        // `shipping_quote_required` guard treats it as "no shipping
        // selected" rather than "shipping selected but no rate to bill
        // against". This was the exact bug the plan calls out: legacy
        // callers defaulted to GIGL even when no quote was chosen,
        // persisting orders with shipping_provider populated but no
        // carrier rate linkage.
        shipping_provider: selectedShippingQuote?.provider ?? null,
        selected_quote_id: selectedShippingQuote?.id ?? null,
        shipping_session_id: shippingSessionId,
        shipping_carrier: selectedShippingQuote?.carrierName,
        shipping_service_tier: selectedShippingQuote?.serviceTier,
      });

      // Store order data for success page (fallback)
      const orderData = {
        order_id: order.id,
        order_number: order.order_number,
        shipping: data,
        items: cart,
        subtotal,
        shipping_fee: finalShippingFee,
        total: order.total,
      };
      sessionStorage.setItem('lastOrder', JSON.stringify(orderData));

      // Track platform-level purchase (for platform owner's analytics)
      trackPlatformPurchase(
        merchant.id,
        order.total as number,
        currencyCode,
        order.order_number as string
      );

      // Handle Credit Direct BNPL checkout
      if (selectedGateway === 'credit_direct') {
        try {
          // Get signature from server
          const signResponse = await fetch('/api/payments/credit-direct/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerEmail: data.email,
              totalAmount: order.total,
              merchantSlug: merchantSlug,
              orderId: order.id,
            }),
          });

          if (!signResponse.ok) {
            const errorData = await signResponse.json();
            throw new Error(
              errorData.error || 'Failed to initialize Credit Direct checkout'
            );
          }

          const { signature, publicKey, sessionId, isLive } =
            await signResponse.json();

          // Build transaction object for Credit Direct
          const transaction = {
            totalAmount: order.total as number,
            customerEmail: data.email,
            customerPhone: data.phone,
            sessionId,
            metaData: order.id as string,
            products: cart.map((item) => ({
              productName: item.name,
              productAmount: item.price,
              productId: item.id,
            })),
          };

          // Configure and open Credit Direct popup
          if (!window.Connect) {
            throw new Error('Credit Direct SDK not loaded');
          }
          const connect = new window.Connect({
            publicKey,
            signature,
            transaction,
            isLive,
            onSuccess: () => {
              clearCart();
              router.push(`/checkout/success?orderId=${order.id}`);
            },
            onClose: () => {
              toast({
                title: 'Checkout Cancelled',
                description: 'You can complete your purchase anytime.',
              });
              setFormIsLoading(false);
            },
            onPopup: async (response: { checkoutTransactionId: string }) => {
              // Save transaction ID to order for webhook reconciliation
              await fetch('/api/orders/update-payment-ref', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: order.id,
                  paymentRef: response.checkoutTransactionId,
                  gateway: 'credit_direct',
                }),
              });
            },
          });

          connect.setup();
          connect.open();
          return; // Don't proceed to success page yet - wait for popup callbacks
        } catch (creditDirectError) {
          console.error('Credit Direct error:', creditDirectError);
          toast({
            variant: 'destructive',
            title: 'BNPL Checkout Failed',
            description:
              (creditDirectError as Error).message ||
              'Failed to start Credit Direct checkout',
          });
          setFormIsLoading(false);
          return;
        }
      }

      toast({
        title: 'Order Placed!',
        description: `Order ${order.order_number} has been placed.`,
      });

      clearCart();

      // Redirect to Paystack/Korapay for payment
      if (paystackAuthUrl && selectedGateway !== 'pod') {
        window.location.href = paystackAuthUrl;
        return;
      }

      // Fallback for demo/testing if no URL returned or if POD
      router.push(`/checkout/success?orderId=${order.id}`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: (error as Error).message || 'Something went wrong.',
      });
    } finally {
      setFormIsLoading(false);
    }
  };

  const getStepTitle = () => {
    if (step === 0) return 'Authentication';
    if (step === 1) return 'Shipping Information';
    return 'Payment';
  };

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background py-10 px-4">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Animated Orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '6s' }}
      />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Checkout Form */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
              {/* Glass Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

              <div className="relative p-6 md:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    {/* biome-ignore lint/suspicious/noExplicitAny: Dynamic route handling */}
                    <Link href={`${basePath || ''}/cart` as any}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-white/10"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">
                      Checkout
                    </h1>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Step {step + 1} of {totalSteps + 1}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <CheckoutProgress
                    currentStep={step + 1}
                    steps={[
                      {
                        label: 'Authentication',
                        description: 'Sign in or Sign up',
                      },
                      { label: 'Shipping', description: 'Delivery details' },
                      { label: 'Payment', description: 'Complete order' },
                    ]}
                  />
                </div>

                {/* Form Content with Animation */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold">
                        {getStepTitle()}
                      </h2>

                      {step === 0 && (
                        <Step0_Auth
                          onAuthSuccess={handleAuthSuccess}
                          onGuestCheckout={handleGuestCheckout}
                          merchantSlug={merchantSlug || merchant?.slug || ''}
                        />
                      )}

                      {step === 1 && (
                        <FormProvider {...shippingForm}>
                          <form className="space-y-6">
                            <Step1_Shipping
                              onShippingSelect={handleShippingSelect}
                              selectedQuote={selectedShippingQuote}
                            />
                            <div className="flex justify-end pt-4">
                              <ThemedButton
                                type="button"
                                onClick={handleNext}
                                disabled={!selectedShippingQuote}
                                className="w-full md:w-auto min-w-[150px] h-11 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                              >
                                Continue to Payment
                              </ThemedButton>
                            </div>
                          </form>
                        </FormProvider>
                      )}

                      {step === 2 && (
                        <div className="space-y-6">
                          <Step2_Payment
                            selectedQuote={selectedShippingQuote}
                            paymentSettings={paymentSettings}
                            selectedGateway={selectedGateway}
                            onGatewaySelect={setSelectedGateway}
                            orderTotal={
                              cartTotal + (shippingFee ?? 0) - discountAmount
                            }
                          />
                          <div className="flex gap-3 pt-4">
                            <Button
                              variant="outline"
                              onClick={handlePrev}
                              className="flex-1 h-11 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80"
                            >
                              Back
                            </Button>
                            <ThemedButton
                              onClick={shippingForm.handleSubmit(
                                onShippingSubmit
                              )}
                              disabled={formIsLoading}
                              className="flex-1 h-11 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                            >
                              {formIsLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : selectedGateway === 'pod' ? (
                                <Truck className="mr-2 h-4 w-4" />
                              ) : (
                                <CreditCard className="mr-2 h-4 w-4" />
                              )}
                              {selectedGateway === 'pod'
                                ? 'Place Order'
                                : `Pay ${new Intl.NumberFormat('en-NG', {
                                    style: 'currency',
                                    currency: 'NGN',
                                  }).format(
                                    cartTotal +
                                      (shippingFee || 0) -
                                      discountAmount
                                  )}`}
                            </ThemedButton>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-xl sticky top-8">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative p-6 md:p-8">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Order Summary
                </h2>

                <OrderSummary
                  shippingFee={shippingFee ?? undefined}
                  discountAmount={discountAmount}
                  discountCode={appliedDiscount?.code}
                />

                <div className="mt-6 pt-6 border-t border-dashed border-primary/20">
                  <DiscountCodeInput
                    merchantId={merchant?.id || ''}
                    cartTotal={cartTotal}
                    onApply={(result) => setAppliedDiscount(result)}
                    onRemove={() => setAppliedDiscount(null)}
                    appliedDiscount={appliedDiscount}
                  />
                </div>

                {/* Trust Badges / Info */}
                <div className="mt-8 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 bg-white/30 dark:bg-black/20 p-3 rounded-xl">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <span>Secure Checkout</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/30 dark:bg-black/20 p-3 rounded-xl">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                      <Truck className="w-3 h-3" />
                    </div>
                    <span>Fast Delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutPageWrapper() {
  const { merchantSlug } = useCart();
  const [routingMode, setRoutingMode] = useState<'domain' | 'path'>('path');

  // Detect routing mode on client side to ensure basePath is correct
  useEffect(() => {
    // If not running on server and we have a window
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      // If the path starts with the merchant slug, it's path-based routing
      // e.g. /ogabassey/checkout
      if (merchantSlug && pathname.startsWith(`/${merchantSlug}`)) {
        setRoutingMode('path');
      } else {
        // Otherwise, it's likely domain-based routing (e.g. custom domain or root)
        // e.g. /checkout on ogabassey.com
        setRoutingMode('domain');
      }
    }
  }, [merchantSlug]);

  return (
    <MerchantProvider
      slug={merchantSlug || undefined}
      initialRoutingMode={routingMode}
    >
      <CheckoutThemeProvider>
        <CheckoutPageContent />
      </CheckoutThemeProvider>
    </MerchantProvider>
  );
}

export default function CheckoutPage() {
  return <CheckoutPageWrapper />;
}
