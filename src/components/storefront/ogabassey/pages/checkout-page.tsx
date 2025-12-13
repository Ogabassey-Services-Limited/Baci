'use client';

import {
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  Plane,
  Share2,
  ShieldCheck,
  Truck,
  MapPin,
  ChevronDown,
  Check,
  Smartphone,
} from 'lucide-react';
import { SmartQuoteLoader } from '../components/SmartQuoteLoader';
import { PaystackLogo, KorapayLogo, CredPalLogo, CreditDirectLogo, PaymentTrustBadges } from '../components/PaymentLogos';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useAuthSafe } from '@/contexts/auth-context';
import { PhoneInput } from '@/components/ui/phone-input';
import { CheckoutAuthModal } from '@/components/storefront/checkout-auth-modal';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { openCredPalCheckout, isCredPalEligible } from '@/lib/credpal';

interface SavedAddress {
  id: number;
  label: string;
  address: string;
  phone: string;
  isDefault: boolean;
}

interface ShippingLocation {
  city: string;
  state: string;
}

interface ShippingQuote {
  id: string;
  provider: string;
  serviceTier: string;
  carrierName: string;
  displayName: string;
  price: number;
  estimatedDays: number;
  currency: string;
}

interface QuoteResponse {
  quotes: {
    featured: ShippingQuote[];
    all: ShippingQuote[];
  };
  sessionId: string;
}

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthSafe();
  const user = auth?.user;

  // Customer form state
  const [customerEmail, setCustomerEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Retrieve gift data if passed from cart
  const giftWrappingCost = Number(searchParams.get('giftWrappingCost')) || 0;

  // Saved Addresses (Future integration: Fetch from API)
  const [addresses, _setAddresses] = useState<SavedAddress[]>([]); // Empty for now, forcing new address


  const [selectedAddressId, setSelectedAddressId] = useState<number>(0);
  const [isNewAddressMode, setIsNewAddressMode] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<
    'pickup' | 'door' | 'airport'
  >('door');
  const [airportType, setAirportType] = useState<'delivery' | 'pickup'>('delivery');

  // Shipping State
  const [shippingStates, setShippingStates] = useState<string[]>([]);
  const [shippingCities, setShippingCities] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');

  // Form State for dynamic address
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');

  // Fetch States on mount
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const res = await fetch('/api/shipping/locations');
        if (res.ok) {
          const data = await res.json();
          setShippingStates(data.states || []);
        }
      } catch (error) {
        console.error('Failed to fetch states', error);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch Cities when State changes
  useEffect(() => {
    if (!newAddressState) {
      setShippingCities([]);
      return;
    }
    const fetchCities = async () => {
      try {
        const res = await fetch(
          `/api/shipping/locations?state=${encodeURIComponent(newAddressState)}`
        );
        if (res.ok) {
          const data = await res.json();
          // Extract unique cities from the locations
          const cities = [
            ...new Set((data.locations as ShippingLocation[]).map((l) => l.city)),
          ].sort();
          setShippingCities(cities);
        }
      } catch (error) {
        console.error('Failed to fetch cities', error);
      }
    };
    fetchCities();
  }, [newAddressState]);

  // Function to fetch quotes
  const fetchShippingQuotes = async (
    address: string,
    state: string,
    city: string,
    phone: string,
    firstName: string,
    lastName: string,
    email: string
  ) => {
    if (!state || !city || !address) return;

    setIsLoadingQuotes(true);
    // setShippingQuotes([]); // KPI: Keep previous quotes visible to avoid UI flash (Optimistic UI)
    setSelectedQuoteId('');

    try {
      const res = await fetch('/api/shipping/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver: {
            name: `${firstName} ${lastName}`.trim() || 'Valued Customer', // Fallback for guest who hasn't typed name yet
            email: email || 'guest@example.com',
            phone: phone || '',
            address,
            city,
            state,
            country: 'Nigeria',
          },
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            weight: 1, // Default weight 1kg if not strictly defined
            value: item.negotiatedPrice || item.price,
          })),
        }),
      });

      if (res.ok) {
        const data: QuoteResponse = await res.json();
        setShippingQuotes(data.quotes.all);

        // Auto-select the first (cheapest) quote if available
        if (data.quotes.all.length > 0) {
          setSelectedQuoteId(data.quotes.all[0].id);
        }
      } else {
        console.warn('Failed to fetch quotes:', await res.text());
      }
    } catch (error) {
      console.error('Error fetching shipping quotes:', error);
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  // Trigger quote fetch when Door Delivery is selected and we have BOTH state AND city
  useEffect(() => {
    if (deliveryMethod === 'door') {
      if (isNewAddressMode) {
        // STRICT: Only fetch if BOTH State AND City are explicitly selected
        // Do NOT use fallbacks - wait for proper location input
        if (newAddressState && newAddressCity) {
          fetchShippingQuotes(
            newAddressStreet || `${newAddressCity}, ${newAddressState}`, // Use city+state as fallback address for API
            newAddressState,
            newAddressCity,
            customerPhone,
            firstName,
            lastName,
            customerEmail
          );
        }
      } else {
        const saved = addresses.find((a) => a.id === selectedAddressId);
        if (saved) {
          // Attempt to extract state/city from saved address string
          // Logic: "Address, City, State" or just "Address" (risky)
          // Improved logic: Try to match against shippingStates if possible, or just send last parts
          const parts = saved.address.split(',').map((s) => s.trim());

          if (parts.length >= 2) {
            const stateCandidate = parts[parts.length - 1];
            const cityCandidate = parts[parts.length - 2];

            // Basic verification: is stateCandidate in our shippingStates list? 
            // (Might be empty if not loaded yet, so just send it)
            if (stateCandidate && cityCandidate) {
              fetchShippingQuotes(
                saved.address,
                stateCandidate,
                cityCandidate,
                saved.phone,
                firstName,
                lastName,
                customerEmail
              );
            }
          }
        }
      }
    }
  }, [
    deliveryMethod,
    selectedAddressId,
    isNewAddressMode,
    // Trigger on State/City change for new address. 
    // NOT triggering on newAddressStreet change to avoid excessive API calls while typing.
    newAddressState,
    newAddressCity,
    // Trigger if we switch back to a saved address
    addresses
  ]);


  // Payment State
  const [paymentTab, setPaymentTab] = useState<'full' | 'installments'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'korapay' | 'credpal' | 'credit_direct' | 'invoice' | 'payforme' | ''>('');

  const [payWithWallet, _setPayWithWallet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Accordion State
  const [currentStep, setCurrentStep] = useState<'contact' | 'delivery' | 'payment'>('contact');
  const [completedSteps, setCompletedSteps] = useState({ contact: false, delivery: false });

  // Pay For Me State
  const [payForMeDetails, setPayForMeDetails] = useState({
    name: '',
    contact: '',
    note: '',
  });

  // Prefill user data if logged in
  useEffect(() => {
    if (user) {
      if (user.email && !customerEmail) setCustomerEmail(user.email);

      // Auto-fill name if not set
      if (!firstName && !lastName) {
        if (user.user_metadata?.full_name) {
          const parts = user.user_metadata.full_name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        } else if (user.user_metadata?.name) {
          const parts = user.user_metadata.name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        } else if (user.user_metadata?.first_name || user.user_metadata?.last_name) {
          setFirstName(user.user_metadata.first_name || '');
          setLastName(user.user_metadata.last_name || '');
        }
      }

      if (user.user_metadata?.phone && !customerPhone) {
        setCustomerPhone(user.user_metadata.phone);
      }
    }
  }, [user, customerEmail, firstName, lastName, customerPhone]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Date Calculation for Door Delivery
  const getDeliveryDateRange = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 3);

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    return `${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
  };

  // DEBUG: Delivery Calculation
  // console.log('DEBUG_DELIVERY', { deliveryMethod, selectedQuoteId, shippingQuotesCount: shippingQuotes.length });
  // if (selectedQuoteId && shippingQuotes.length > 0) {
  //    const quote = shippingQuotes.find(q => q.id === selectedQuoteId);
  //    console.log('DEBUG_QUOTE_FOUND', quote);
  // }

  const deliveryCost =
    deliveryMethod === 'pickup'
      ? 0
      : deliveryMethod === 'door'
        ? selectedQuoteId
          ? shippingQuotes.find(q => String(q.id) === String(selectedQuoteId))?.price ?? 0
          : 0 // Fallback: 0 if loading or no quote selected
        : airportType === 'delivery' ? 25000 : 20000; // Airport Delivery: ₦25,000, Airport Pickup: ₦20,000

  const total = cartTotal + deliveryCost + giftWrappingCost;

  // Wallet feature disabled (future integration)
  const walletAmountUsed = 0;
  const remainingAmount = total - walletAmountUsed;

  const handlePlaceOrder = async () => {
    if (!merchant?.id) {
      alert('Merchant context not available. Please try again.');
      return;
    }

    if (!customerEmail || !firstName || !lastName) {
      alert('Please fill in your name and email.');
      return;
    }

    setIsProcessing(true);

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

    // Construct address string properly based on delivery method
    let finalAddress = 'Address not provided';
    let finalCity = '';
    let finalState = '';

    // Only require full address for door delivery
    if (deliveryMethod === 'door') {
      if (isNewAddressMode) {
        if (!newAddressStreet || !newAddressCity || !newAddressState) {
          alert('Please enter your full address (Street, City, State).');
          setIsProcessing(false);
          return;
        }
        finalAddress = `${newAddressStreet}, ${newAddressCity}, ${newAddressState}`;
        finalCity = newAddressCity;
        finalState = newAddressState;
      } else {
        finalAddress = selectedAddress?.address || 'Address not provided';
        // Try to parse city/state from saved string if possible
        const parts = finalAddress.split(',');
        if (parts.length >= 2) {
          finalState = parts[parts.length - 1]?.trim() || '';
          finalCity = parts[parts.length - 2]?.trim() || '';
        }
      }
    } else if (deliveryMethod === 'pickup') {
      finalAddress = 'Pickup at Store';
      finalCity = 'Lagos';
      finalState = 'Lagos';
    } else if (deliveryMethod === 'airport') {
      // For airport, use the city/state from address if available, otherwise use defaults
      finalAddress = newAddressStreet || `Airport ${airportType === 'pickup' ? 'Pickup' : 'Delivery'}`;
      finalCity = newAddressCity || 'Airport';
      finalState = newAddressState || 'Nigeria';
    }

    const shippingAddressData = {
      address: finalAddress,
      city: finalCity,
      state: finalState,
      phone: customerPhone || selectedAddress?.phone || '',
    };

    // Identify selected shipping provider
    let shippingProvider = 'Standard';
    let trackingNumber = undefined;

    // Prepare order items for API
    const orderItems = cart.map((item) => ({
      product_id: String(item.id),
      name: item.name,
      quantity: item.quantity,
      price: item.negotiatedPrice || item.price,
      value: (item.negotiatedPrice || item.price) * item.quantity,
      // Assurance Integration
      has_assurance: item.hasAssurance || false,
      assurance_fee: item.hasAssurance ? ((item.negotiatedPrice || item.price) * (item.assuranceRate || 0.05)) : 0,
    }));

    if (deliveryMethod === 'door' && selectedQuoteId) {
      const quote = shippingQuotes.find(q => String(q.id) === String(selectedQuoteId));
      if (quote) {
        shippingProvider = quote.provider; // e.g. 'GIGL', 'Topship'
      }
    } else if (deliveryMethod === 'pickup') {
      shippingProvider = 'Pickup';
    } else if (deliveryMethod === 'airport') {
      shippingProvider = 'Airport';
    }

    try {
      // 1. Create order in database via API
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchant.id,
          customer_email: customerEmail,
          customer_name: `${firstName} ${lastName}`.trim(),
          customer_phone: customerPhone,
          items: orderItems,
          subtotal: cartTotal,
          shipping_fee: deliveryCost,
          payment_method:
            paymentMethod === 'paystack' || paymentMethod === 'korapay'
              ? 'card'
              : paymentMethod === 'credit_direct' || paymentMethod === 'credpal'
                ? 'bnpl'
                : paymentMethod === 'invoice'
                  ? 'invoice'
                  : 'pod',
          payment_status: 'unpaid',
          shipping_status: 'pending',
          shipping_address: shippingAddressData,
          source: 'online_store',
          shipping_provider: shippingProvider,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error('Order creation failed:', {
          status: orderResponse.status,
          error: errorData.error,
          details: errorData.details,
          fullResponse: errorData
        });
        throw new Error(errorData.details || errorData.error || 'Failed to create order');
      }

      const { order } = await orderResponse.json();

      // 2. Handle payment based on method
      if (paymentMethod === 'paystack' || paymentMethod === 'korapay') {
        // Initialize payment via API - supports both Paystack and Korapay
        const paymentResponse = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: merchant.id,
            order_id: order.id,
            amount: total,
            currency: 'NGN',
            customer_email: customerEmail,
            customer_name: `${firstName} ${lastName}`.trim(),
            gateway: paymentMethod, // Explicitly specify gateway

          }),
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          throw new Error(errorData.error || 'Payment initialization failed');
        }

        const paymentResult = await paymentResponse.json();

        if (paymentResult.success && paymentResult.authorization_url) {
          // NOTE: Don't clear cart here - it causes a flash of empty state
          // Cart will be cleared on the payment callback page after successful payment
          window.location.href = paymentResult.authorization_url;
          return;
        } else {
          throw new Error('Payment initialization failed: No auth URL returned');
        }
      } else if (paymentMethod === 'credit_direct') {
        // Credit Direct BNPL - Initialize via API
        const bnplResponse = await fetch('/api/payments/bnpl/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: merchant.id,
            order_id: order.id,
            amount: total,
            currency: 'NGN',
            customer_email: customerEmail,
            customer_name: `${firstName} ${lastName}`.trim(),
            customer_phone: customerPhone,
            items: cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              amount: item.negotiatedPrice || item.price,
            })),
          }),
        });

        if (!bnplResponse.ok) {
          // Fallback: redirect to order success with pending BNPL status
          clearCart();
          router.push(`/order-success?type=credit_direct&orderId=${order.id}&status=pending`);
          return;
        }

        const bnplResult = await bnplResponse.json();

        if (bnplResult.success && bnplResult.checkout_url) {
          clearCart();
          window.location.href = bnplResult.checkout_url;
          return;
        } else {
          // Fallback to success page with pending
          clearCart();
          router.push(`/order-success?type=credit_direct&orderId=${order.id}&status=pending`);
        }
      } else if (paymentMethod === 'credpal') {
        // CredPal BNPL - Client-side popup checkout
        const credpalKey = process.env.NEXT_PUBLIC_CREDPAL_KEY;

        if (!credpalKey) {
          // Fallback if key not configured
          clearCart();
          router.push(`/order-success?type=credpal&orderId=${order.id}&status=pending`);
          return;
        }

        // Open CredPal popup
        await openCredPalCheckout({
          key: credpalKey,
          amount: total,
          product: cart.map(item => item.name).join(', '),
          customerEmail,
          customerName: `${firstName} ${lastName}`.trim(),
          customerPhone,
          onSuccess: (data) => {
            console.log('CredPal success:', data);
            clearCart();
            router.push(`/order-success?type=credpal&orderId=${order.id}&credpalRef=${data.order_no}`);
          },
          onError: (error) => {
            console.error('CredPal error:', error);
            alert(error.message || 'CredPal checkout failed. Please try again.');
            setIsProcessing(false);
          },
          onClose: () => {
            setIsProcessing(false);
          },
        });
        // Don't proceed further - callbacks handle the flow
        return;
      } else if (paymentMethod === 'invoice') {
        // Invoice/Pay Later - order created, redirect to success
        clearCart();
        router.push(`/order-success?type=invoice&orderId=${order.id}`);
      } else if (paymentMethod === 'payforme') {
        // Pay For Me - TODO: send payment link
        clearCart();
        router.push(
          `/order-success?type=payforme&orderId=${order.id}&payerName=${encodeURIComponent(
            payForMeDetails.name
          )}`
        );
      } else {
        // Default: POD or other
        clearCart();
        router.push(`/order-success?type=standard&orderId=${order.id}`);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'An error occurred. Please try again.'
      );
      setIsProcessing(false);
    }
  };

  const isPayForMeValid =
    paymentMethod === 'payforme'
      ? payForMeDetails.name && payForMeDetails.contact
      : true;

  // Empty cart - show inline state (no redirect to avoid hydration issues)
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center pb-20">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-6">
            Add some items to your cart before checking out.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Continue Shopping
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <CheckoutAuthModal
        isOpen={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-red-200 shadow-lg">
              <ShieldCheck size={20} />
            </span>
            Secure Checkout
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SSL Encrypted
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT COLUMN: Accordion Steps */}
          <div className="lg:col-span-8 space-y-6">

            {/* Accordion Step 1: Contact Information */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'contact' ? 'border-red-600 ring-1 ring-red-100' : 'border-gray-100'} overflow-hidden transition-all duration-300`}>
              <button
                type="button"
                onClick={() => setCurrentStep('contact')}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.contact ? 'bg-green-100 text-green-600' : currentStep === 'contact' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {completedSteps.contact ? <Check size={14} /> : '1'}
                  </div>
                  Contact Information
                </h2>
                {completedSteps.contact && currentStep !== 'contact' && (
                  <span className="text-sm font-medium text-red-600 hover:text-red-700">Edit</span>
                )}
              </button>

              {/* Collapsible Content */}
              <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'contact' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="p-6 pt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                        Phone Number
                      </label>
                      <PhoneInput
                        value={customerPhone}
                        onChange={(value) => setCustomerPhone(value || '')}
                        placeholder="+234 800 000 0000"
                        defaultCountry="NG"
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (firstName && lastName && customerEmail) {
                            setCompletedSteps(prev => ({ ...prev, contact: true }));
                            setCurrentStep('delivery');
                          } else {
                            alert("Please fill in all required fields");
                          }
                        }}
                        className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors w-full md:w-auto"
                      >
                        Continue to Delivery
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Delivery Method */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'delivery' ? 'border-red-600 ring-1 ring-red-100' : 'border-gray-100'} transition-all duration-300`}>
              <button
                type="button"
                onClick={() => completedSteps.contact && setCurrentStep('delivery')}
                disabled={!completedSteps.contact}
                className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.delivery ? 'bg-green-100 text-green-600' : currentStep === 'delivery' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {completedSteps.delivery ? <Check size={14} /> : '2'}
                  </div>
                  Delivery Method
                </h2>
                {completedSteps.delivery && currentStep !== 'delivery' && (
                  <span className="text-sm font-medium text-red-600 hover:text-red-700">Edit</span>
                )}
              </button>

              <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'delivery' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className={currentStep === 'delivery' ? 'overflow-visible' : 'overflow-hidden'}>
                  <div className="p-6 pt-0 space-y-4">
                    {/* STEP 1: Address Input FIRST */}
                    <div className="space-y-4">
                      {/* Saved Addresses (for logged in users) */}
                      {user && addresses.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                              Where should we deliver?
                            </label>
                            <button
                              onClick={() => setIsNewAddressMode(!isNewAddressMode)}
                              className="text-xs font-bold text-red-600 hover:underline"
                            >
                              {isNewAddressMode ? 'Select Saved Address' : '+ New Address'}
                            </button>
                          </div>
                          {!isNewAddressMode && addresses.map((addr) => (
                            <label
                              key={addr.id}
                              className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr.id
                                ? 'border-red-600 bg-red-50/50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                              <input
                                type="radio"
                                name="address"
                                checked={selectedAddressId === addr.id}
                                onChange={() => {
                                  setSelectedAddressId(addr.id);
                                  setIsNewAddressMode(false);
                                  // Extract state from saved address for eligibility checks
                                  const parts = addr.address.split(',').map(s => s.trim());
                                  if (parts.length >= 2) {
                                    setNewAddressState(parts[parts.length - 1] || '');
                                    setNewAddressCity(parts[parts.length - 2] || '');
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                              />
                              <div className="ml-3">
                                <p className="font-bold text-gray-900 text-sm">
                                  {addr.label || 'Saved Address'}
                                </p>
                                <p className="text-gray-600 text-sm mt-0.5">
                                  {addr.address}
                                </p>
                                <p className="text-gray-500 text-xs mt-1">
                                  {addr.phone}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* New Address Form */}
                      {(isNewAddressMode || !user || addresses.length === 0) && (
                        <div className="space-y-4" style={{ overflow: 'visible' }}>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            {user && addresses.length > 0 ? 'Enter New Address' : 'Delivery Address'}
                          </label>
                          <AddressAutocomplete
                            value={newAddressStreet}
                            onChange={(val) => {
                              const newVal = typeof val === 'string' ? val : val.target.value;
                              setNewAddressStreet(newVal);

                              // Reset state/city if address is cleared or changed significantly
                              if (!newVal || newVal.length < 10) {
                                setNewAddressState('');
                                setNewAddressCity('');
                                setShippingQuotes([]);
                                setSelectedQuoteId('');
                                setDeliveryMethod('door'); // Reset to default
                              }
                            }}
                            onSelect={(place: any) => {
                              setNewAddressStreet(place.formattedAddress);
                              if (place.state) {
                                setNewAddressState(place.state);
                              }
                              if (place.city) {
                                setNewAddressCity(place.city);
                              }
                            }}
                            placeholder="Start typing your address..."
                            country="NG"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                          />
                          {newAddressState && newAddressCity && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <Check size={12} /> Detected: {newAddressCity}, {newAddressState}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STEP 2: Delivery Method Cards - ONLY show AFTER address is detected */}
                    {((newAddressState && newAddressCity) || (!isNewAddressMode && selectedAddressId)) && (
                      <>
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                            How would you like to receive your order?
                          </label>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {(['door', 'pickup', 'airport'] as const).map((method) => {
                              // Filter out Pickup if not in Lagos (store is in Lagos)
                              if (method === 'pickup') {
                                const currentState = newAddressState;
                                const isLagos = currentState && currentState.toLowerCase() === 'lagos';
                                if (!isLagos) return null;
                              }

                              // Filter out Airport if not eligible (non-Lagos states only)
                              if (method === 'airport') {
                                const AIRPORT_STATES = [
                                  'Abuja', 'FCT', 'Federal Capital Territory', 'FCT - Abuja',
                                  'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
                                  'Borno', 'Cross River', 'Delta', 'Edo', 'Enugu', 'Gombe',
                                  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
                                  'Kwara', 'Niger', 'Ondo', 'Oyo', 'Plateau', 'Rivers',
                                  'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
                                ];
                                const currentState = newAddressState;
                                const isEligible = currentState && AIRPORT_STATES.some(s => s.toLowerCase() === currentState.toLowerCase()) && currentState.toLowerCase() !== 'lagos';
                                if (!isEligible) return null;
                              }

                              const Icon = method === 'door' ? Truck : method === 'pickup' ? Building2 : Plane;
                              const label = method === 'door' ? 'Door Delivery' : method === 'pickup' ? 'Pickup' : 'Airport';
                              const subtitle = method === 'door' ? 'To your address' : method === 'pickup' ? 'Collect at store' : 'Via air cargo';

                              return (
                                <button
                                  key={method}
                                  onClick={() => setDeliveryMethod(method)}
                                  className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-1 min-w-[100px] ${deliveryMethod === method
                                    ? 'border-red-600 bg-red-50 text-red-700'
                                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                  <Icon className={`w-6 h-6 ${deliveryMethod === method ? 'text-red-600' : 'text-gray-400'}`} />
                                  <span className="text-xs sm:text-sm font-bold">{label}</span>
                                  <span className="text-[10px] text-gray-400">{subtitle}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* STEP 3: Delivery Method Details */}
                        {/* Pickup Info */}
                        {deliveryMethod === 'pickup' && (
                          <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-4 animate-in fade-in">
                            <div className="bg-white p-2 rounded-lg border border-gray-200">
                              <Building2 size={24} className="text-gray-600" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 text-sm">Main Office Pickup</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Available for pickup at our Ikeja Store. Usually ready within 2 hours.
                              </p>
                              <div className="mt-2 text-xs font-mono bg-white inline-block px-2 py-1 rounded border border-gray-200 text-gray-500">
                                Pickup closes at 6 PM
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Airport Options */}
                        {deliveryMethod === 'airport' && (
                          <div className="mt-4 space-y-3 animate-in fade-in">
                            <div className="flex items-start gap-3">
                              <Plane size={20} className="text-gray-500 mt-0.5" />
                              <p className="text-sm text-gray-600">
                                Delivery to your nearest airport. Choose delivery to your location or pickup at the airport.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label
                                className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'delivery'
                                  ? 'border-red-600 bg-red-50'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="airportType"
                                  value="delivery"
                                  checked={airportType === 'delivery'}
                                  onChange={() => setAirportType('delivery')}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'delivery' ? 'border-red-600' : 'border-gray-400'
                                  }`}>
                                  {airportType === 'delivery' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">Airport Delivery</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Delivered to your address</p>
                                </div>
                                <span className="font-bold text-gray-900">₦25,000</span>
                              </label>
                              <label
                                className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'pickup'
                                  ? 'border-red-600 bg-red-50'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="airportType"
                                  value="pickup"
                                  checked={airportType === 'pickup'}
                                  onChange={() => setAirportType('pickup')}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'pickup' ? 'border-red-600' : 'border-gray-400'
                                  }`}>
                                  {airportType === 'pickup' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">Airport Pickup</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Collect at the airport</p>
                                </div>
                                <span className="font-bold text-gray-900">₦20,000</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Door Delivery - Quote Selector */}
                        {deliveryMethod === 'door' && (
                          <div className="mt-6 border-t border-gray-100 pt-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                              Select Delivery Option
                            </label>

                            {isLoadingQuotes ? (
                              <SmartQuoteLoader />
                            ) : shippingQuotes.length > 0 ? (
                              <div className="space-y-3">
                                {shippingQuotes.map((quote) => (
                                  <label
                                    key={quote.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-red-300 transition-all ${selectedQuoteId === quote.id
                                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                      : 'border-gray-100 bg-white'
                                      }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="radio"
                                        name="shipping_quote"
                                        checked={selectedQuoteId === quote.id}
                                        onChange={() => setSelectedQuoteId(quote.id)}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                      />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-900">{quote.displayName}</span>
                                          {quote.carrierName.includes('GIG') && <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-bold">GIGL</span>}
                                          {quote.carrierName.includes('Topship') && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Best Value</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Est. Delivery: {(quote as any).deliveryRange || `${quote.estimatedDays} days`}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-bold text-sm text-gray-900">
                                      ₦{quote.price.toLocaleString()}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (newAddressState && newAddressCity) {
                                    fetchShippingQuotes(
                                      newAddressStreet || `${newAddressCity}, ${newAddressState}`,
                                      newAddressState,
                                      newAddressCity,
                                      customerPhone,
                                      firstName,
                                      lastName,
                                      customerEmail
                                    );
                                  }
                                }}
                                className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-amber-400 hover:shadow-md transition-all group cursor-pointer"
                              >
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                  <Truck size={24} />
                                </div>
                                <div className="text-center">
                                  <h4 className="text-sm font-bold text-gray-900">🚚 Oops! Rates took a detour</h4>
                                  <p className="text-xs text-amber-700 mt-1">
                                    Our delivery partners are a bit slow today. Tap here to try again!
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full group-hover:bg-amber-200 transition-colors">
                                  ↻ Refresh Rates
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedSteps(prev => ({ ...prev, delivery: true }));
                          setCurrentStep('payment');
                        }}
                        className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors w-full md:w-auto"
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Payment Method */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'payment' ? 'border-red-600 ring-1 ring-red-100' : 'border-gray-100'} overflow-hidden transition-all duration-300`}>
              <button
                type="button"
                onClick={() => completedSteps.delivery && setCurrentStep('payment')}
                disabled={!completedSteps.delivery}
                className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${paymentMethod ? 'bg-green-100 text-green-600' : currentStep === 'payment' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {paymentMethod ? <Check size={14} /> : '3'}
                  </div>
                  Payment Method
                </h2>
              </button>

              <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'payment' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="p-6 pt-0 space-y-4">
                    {/* Payment Tab Selector */}
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => { setPaymentTab('full'); setPaymentMethod(''); }}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${paymentTab === 'full'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Pay in Full
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaymentTab('installments'); setPaymentMethod(''); }}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${paymentTab === 'installments'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Pay in Installments
                      </button>
                    </div>

                    {/* Pay in Full Options */}
                    {paymentTab === 'full' && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-xs text-gray-500">Select a payment gateway:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Paystack */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'paystack'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="paystack"
                              checked={paymentMethod === 'paystack'}
                              onChange={() => setPaymentMethod('paystack')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'paystack' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'paystack' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900">Paystack</span>
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Popular</span>
                              </div>
                              <span className="text-xs text-gray-500 block mt-0.5">Card, Bank Transfer, USSD</span>
                            </div>
                            <PaystackLogo className="w-6 h-6" />
                          </label>

                          {/* Korapay */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'korapay'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="korapay"
                              checked={paymentMethod === 'korapay'}
                              onChange={() => setPaymentMethod('korapay')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'korapay' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'korapay' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-gray-900 block">Korapay</span>
                              <span className="text-xs text-gray-500 block mt-0.5">Card, Bank Transfer, Mobile Money</span>
                            </div>
                            <KorapayLogo className="w-6 h-6" />
                          </label>

                          {/* Invoice / Pay Later */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'invoice'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="invoice"
                              checked={paymentMethod === 'invoice'}
                              onChange={() => setPaymentMethod('invoice')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'invoice' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'invoice' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-gray-900 block">Invoice</span>
                              <span className="text-xs text-gray-500 block mt-0.5">Generate invoice to pay later</span>
                            </div>
                            <FileText size={20} className="text-gray-400" />
                          </label>

                          {/* Pay For Me */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'payforme'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="payforme"
                              checked={paymentMethod === 'payforme'}
                              onChange={() => setPaymentMethod('payforme')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'payforme' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'payforme' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-gray-900 block">Pay For Me</span>
                              <span className="text-xs text-gray-500 block mt-0.5">Send payment link to someone</span>
                            </div>
                            <Share2 size={20} className="text-gray-400" />
                          </label>
                        </div>

                        {/* Pay For Me Details */}
                        {paymentMethod === 'payforme' && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-in slide-in-from-top-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Who is paying?</h3>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Payer's Name</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                                  value={payForMeDetails.name}
                                  onChange={(e) => setPayForMeDetails({ ...payForMeDetails, name: e.target.value })}
                                  placeholder="e.g. Daddy"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Payer's Phone / Email</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                                  value={payForMeDetails.contact}
                                  onChange={(e) => setPayForMeDetails({ ...payForMeDetails, contact: e.target.value })}
                                  placeholder="+234..."
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pay in Installments Options */}
                    {paymentTab === 'installments' && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-xs text-gray-500">Buy Now, Pay Later options:</p>
                        <div className="grid grid-cols-1 gap-3">
                          {/* CredPal */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'credpal'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="credpal"
                              checked={paymentMethod === 'credpal'}
                              onChange={() => setPaymentMethod('credpal')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credpal' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'credpal' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900">CredPal</span>
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Salary earners only</span>
                              </div>
                              <span className="text-xs text-gray-500 block mt-0.5">Pay in 3-6 monthly installments</span>
                            </div>
                            <CredPalLogo className="w-6 h-6" />
                          </label>

                          {/* Credit Direct */}
                          <label
                            className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'credit_direct'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value="credit_direct"
                              checked={paymentMethod === 'credit_direct'}
                              onChange={() => setPaymentMethod('credit_direct')}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credit_direct' ? 'border-red-600' : 'border-gray-400'}`}>
                              {paymentMethod === 'credit_direct' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900">Credit Direct</span>
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Salary & Business owners</span>
                              </div>
                              <span className="text-xs text-gray-500 block mt-0.5">Pay in 3-6 monthly installments</span>
                            </div>
                            <CreditDirectLogo className="w-6 h-6" />
                          </label>
                        </div>

                        {/* CredPal Info */}
                        {paymentMethod === 'credpal' && (
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <CreditCard size={16} className="text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">How CredPal works</h4>
                                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                  <li>• Quick approval in minutes</li>
                                  <li>• Pay over 3-12 months</li>
                                  <li>• Competitive interest rates</li>
                                  <li>• Receive your items immediately</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Credit Direct Info */}
                        {paymentMethod === 'credit_direct' && (
                          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <CreditCard size={16} className="text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">How Credit Direct works</h4>
                                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                  <li>• Instant approval decision</li>
                                  <li>• Pay over 3-12 months</li>
                                  <li>• No hidden fees</li>
                                  <li>• Get your items immediately</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Order Summary */}
          < div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6" >
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Order Summary
              </h2>

              {/* Items List (Collapsed View) */}
              <div className="space-y-4 mb-6 max-h-[200px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 p-1 flex-shrink-0">
                      <img
                        src={item.image || '/placeholder.png'}
                        alt={item.name}
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/placeholder.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">
                        {item.name}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
                        <span>Qty: {item.quantity}</span>
                        <span>
                          ₦
                          {(
                            item.negotiatedPrice || item.price
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-200 my-4" />

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Subtotal</span>
                  <span>₦{cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Delivery</span>
                  <span
                    className={
                      deliveryCost === 0
                        ? 'text-green-600 font-bold'
                        : 'text-gray-900'
                    }
                  >
                    {deliveryMethod === 'door' && !selectedQuoteId && deliveryCost === 0
                      ? <span className="text-gray-500 font-normal italic">Calculated...</span>
                      : deliveryCost === 0 ? 'Free' : `₦${deliveryCost.toLocaleString()}`}
                  </span>
                </div>
                {giftWrappingCost > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Gift Wrapping</span>
                    <span>₦{giftWrappingCost.toLocaleString()}</span>
                  </div>
                )}

                {/* Wallet Deduction Line */}
                {payWithWallet && (
                  <div className="flex justify-between text-green-700 text-sm font-medium animate-in fade-in">
                    <span>Wallet Debit</span>
                    <span>-₦{walletAmountUsed.toLocaleString()}</span>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-200 my-2" />

                {/* Total or Amount Due */}
                <div className="flex justify-between text-gray-900 font-bold text-lg">
                  <span>
                    {remainingAmount > 0 && payWithWallet
                      ? 'Amount Due'
                      : 'Total'}
                  </span>
                  <span>₦{remainingAmount.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={
                  isProcessing ||
                  (remainingAmount > 0 && !paymentMethod) ||
                  (paymentMethod === 'payforme' && !isPayForMeValid)
                }
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-200 active:scale-[0.98]"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" />
                ) : paymentMethod === 'invoice' ? (
                  'Generate Invoice'
                ) : paymentMethod === 'payforme' ? (
                  'Send Payment Link'
                ) : (
                  'Place Order'
                )}
                {!isProcessing && <ChevronRight size={20} />}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
                <ShieldCheck size={14} /> Secure Encrypted Payment
              </div>
            </div>
          </div>
        </div>
      </div >
    </div >
  );
};
