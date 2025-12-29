import { View, Text, ScrollView, Pressable, TextInput, StatusBar, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../stores/cart-store';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { PhoneInput } from '../components/storefront/PhoneInput';
import { AddressAutocomplete, PlaceDetails } from '../components/storefront/AddressAutocomplete';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';

// Mobile app targets the main Ogabassey store
const TARGET_MERCHANT_SLUG = 'ogabassey';
const API_BASE = 'https://ogabassey.com';


interface FormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    deliveryMethod: 'door' | 'pickup' | 'airport';
    airportType: 'pickup' | 'delivery';
}

export default function Checkout() {
    // Use Zustand store directly to avoid QueryClient context dependency
    const items = useCartStore((state) => state.items);
    const cartTotal = useCartStore((state) => state.cartTotal());
    const clearCart = useCartStore((state) => state.clearCart);
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<'contact' | 'delivery' | 'payment'>('contact');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentTab, setPaymentTab] = useState<'full' | 'installments'>('full');
    const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'korapay' | 'juicyway' | 'credpal' | 'credit_direct' | ''>('');
    const [merchantId, setMerchantId] = useState<string | null>(null);

    // Fetch Merchant ID on mount
    useEffect(() => {
        async function fetchMerchant() {
            try {
                const { data, error } = await supabase
                    .from('merchants')
                    .select('id')
                    .eq('slug', TARGET_MERCHANT_SLUG)
                    .single();

                if (data?.id) {
                    setMerchantId(data.id);
                }
            } catch (err) {
                console.error('Error fetching merchant:', err);
            }
        }
        fetchMerchant();
    }, []);

    // Delivery Logic
    const [formData, setFormData] = useState<FormData>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        deliveryMethod: 'door',
        airportType: 'pickup', // Default to pickup (cheaper)
    });

    // Shipping quotes state
    interface ShippingQuote {
        id: string;
        provider: string;
        carrierName: string;
        displayName: string;
        price: number;
        estimatedDays: number;
        currency: string;
    }
    const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
    const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
    const [quotesError, setQuotesError] = useState<string | null>(null);

    // Crypto Payment State
    const [cryptoModalVisible, setCryptoModalVisible] = useState(false);
    const [cryptoNetwork, setCryptoNetwork] = useState<'TRX' | 'ETH' | 'MATIC'>('TRX');
    const [cryptoDetails, setCryptoDetails] = useState<{
        address: string;
        amount: number; // Amount in minor units (cents)
        currency: string;
        chain: string;
        orderId: string;
        ngnAmount: number; // Original NGN amount for reference
    } | null>(null);

    // Fetch shipping quotes when address is complete
    const fetchShippingQuotes = async () => {
        if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim()) {
            return;
        }

        setIsLoadingQuotes(true);
        setQuotesError(null);

        try {
            const response = await fetch(`${API_BASE}/api/shipping/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiver: {
                        name: `${formData.firstName} ${formData.lastName}`.trim() || 'Customer',
                        email: formData.email || 'guest@example.com',
                        phone: formData.phone || '',
                        address: formData.address,
                        city: formData.city,
                        state: formData.state,
                        country: 'Nigeria',
                    },
                    items: items.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        weight: 1, // Default weight
                        value: item.price,
                    })),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const quotes = data.quotes?.all || [];
                setShippingQuotes(quotes);
                // Auto-select the first (cheapest) quote
                if (quotes.length > 0) {
                    setSelectedQuoteId(quotes[0].id);
                }
            } else {
                setQuotesError('Unable to fetch shipping options. Please check your address.');
            }
        } catch (error) {
            console.error('Error fetching shipping quotes:', error);
            setQuotesError('Network error. Please try again.');
        } finally {
            setIsLoadingQuotes(false);
        }
    };

    // Fetch quotes when address fields are complete and delivery method is 'door'
    useEffect(() => {
        if (formData.deliveryMethod === 'door' &&
            formData.address.trim() &&
            formData.city.trim() &&
            formData.state.trim() &&
            shippingQuotes.length === 0) {
            fetchShippingQuotes();
        }
    }, [formData.address, formData.city, formData.state, formData.deliveryMethod]);

    const updateField = (key: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        // Clear quotes when address changes (so they refresh)
        if (key === 'address' || key === 'city' || key === 'state') {
            setShippingQuotes([]);
            setSelectedQuoteId('');
        }
    };

    const validateContact = () => {
        if (!formData.firstName.trim()) {
            Alert.alert('Error', 'Please enter your first name');
            return false;
        }
        if (!formData.lastName.trim()) {
            Alert.alert('Error', 'Please enter your surname');
            return false;
        }
        // Basic phone validation: must be digits only, at least 10 characters
        const phoneDigits = formData.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            Alert.alert('Error', 'Please enter a valid phone number (at least 10 digits)');
            return false;
        }
        if (!formData.email.trim() || !formData.email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email address');
            return false;
        }
        return true;
    };

    const validateDelivery = () => {
        if (formData.deliveryMethod === 'door') {
            if (!formData.address.trim()) {
                Alert.alert('Error', 'Please enter your delivery address');
                return false;
            }
            if (!formData.city.trim()) {
                Alert.alert('Error', 'Please enter your city');
                return false;
            }
            if (!formData.state.trim()) {
                Alert.alert('Error', 'Please enter your state');
                return false;
            }
            // Require shipping option selection
            if (!selectedQuoteId) {
                Alert.alert('Error', 'Please select a shipping option');
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (step === 'contact' && validateContact()) {
            setStep('delivery');
        } else if (step === 'delivery' && validateDelivery()) {
            setStep('payment');
        }
    };

    const handleBack = () => {
        if (step === 'delivery') setStep('contact');
        else if (step === 'payment') setStep('delivery');
        else router.back();
    };

    const calculateDeliveryCost = () => {
        if (formData.deliveryMethod === 'pickup') return 0;
        if (formData.deliveryMethod === 'door') {
            // Use selected shipping quote price if available
            const selectedQuote = shippingQuotes.find(q => q.id === selectedQuoteId);
            if (selectedQuote) return selectedQuote.price;
            return 0; // Will show 0 until quote is selected
        }
        if (formData.deliveryMethod === 'airport') {
            return formData.airportType === 'delivery' ? 25000 : 20000;
        }
        return 0;
    };

    const deliveryCost = calculateDeliveryCost();
    const total = cartTotal + deliveryCost;

    const handlePlaceOrder = async () => {
        if (!merchantId) {
            Alert.alert("Error", "Store configuration not loaded. Please try again.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Prepare Order Payload
            const orderPayload = {
                merchant_id: merchantId,
                customer_email: formData.email,
                customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
                customer_phone: formData.phone,
                items: items.map(item => ({
                    product_id: String(item.product_id), // Use product_id not id (cart id)
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    value: item.price * item.quantity,
                })),
                subtotal: cartTotal,
                shipping_fee: deliveryCost,
                payment_method: paymentMethod === 'paystack' || paymentMethod === 'korapay'
                    ? 'card'
                    : paymentMethod, // 'credpal', 'credit_direct', 'juicyway'
                payment_status: 'unpaid',
                shipping_status: 'pending',
                shipping_address: {
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    phone: formData.phone
                },
                source: 'mobile_app',
                shipping_provider: formData.deliveryMethod === 'door' ? 'Standard' : formData.deliveryMethod === 'pickup' ? 'Pickup' : 'Airport'
            };

            // 2. Create Order
            const orderResponse = await fetch(`${API_BASE}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json();
                throw new Error(errorData.error || 'Failed to create order');
            }

            const { order, amountDueToGateway } = await orderResponse.json();
            const paymentAmount = amountDueToGateway ?? total;

            // 3. Initialize Payment
            if (paymentMethod === 'paystack' || paymentMethod === 'korapay' || paymentMethod === 'juicyway') {
                // Create callback URL for deep linking back to app
                const callbackUrl = Linking.createURL('payment-callback', {
                    queryParams: { orderId: order.id, gateway: paymentMethod }
                });

                const initResponse = await fetch(`${API_BASE}/api/payments/initialize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_id: merchantId,
                        order_id: order.id,
                        amount: paymentAmount,
                        currency: 'NGN',
                        customer_email: formData.email,
                        customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
                        customer_phone: formData.phone,
                        gateway: paymentMethod,
                        callback_url: callbackUrl, // Pass callback for redirect
                        ...(paymentMethod === 'juicyway' && {
                            crypto_chain: cryptoNetwork,
                            crypto_currency: 'USDT'
                        })
                    })
                });

                if (!initResponse.ok) {
                    const errorData = await initResponse.json();
                    throw new Error(errorData.details || errorData.error || 'Failed to initialize payment');
                }

                const paymentData = await initResponse.json();

                if (paymentData.crypto_payment) {
                    setCryptoDetails({
                        address: paymentData.crypto_payment.address,
                        amount: paymentData.crypto_payment.amount,
                        currency: paymentData.crypto_payment.currency || 'USDT',
                        chain: paymentData.crypto_payment.chain || cryptoNetwork,
                        orderId: order.id,
                        ngnAmount: paymentAmount // Store original NGN amount
                    });
                    setCryptoModalVisible(true);
                    setIsSubmitting(false); // Reset so user can change network if needed
                    // Don't navigate yet - wait for user confirmation in modal

                } else if (paymentData.success && (paymentData.authorization_url || paymentData.checkout_url)) {
                    const url = paymentData.authorization_url || paymentData.checkout_url;

                    // Use openBrowserAsync to avoid the iOS "Sign In" consent prompt
                    // This opens an in-app browser without the authentication session
                    await WebBrowser.openBrowserAsync(url, {
                        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        dismissButtonStyle: 'done',
                    });

                    // After browser closes, verify payment status
                    const verifyResponse = await fetch(`${API_BASE}/api/orders/${order.id}`);
                    const orderStatus = await verifyResponse.json();

                    if (orderStatus.payment_status === 'paid' || orderStatus.status === 'confirmed') {
                        // Payment confirmed!
                        clearCart();
                        router.push({
                            pathname: '/order-success',
                            params: {
                                orderId: order.id,
                                type: paymentMethod,
                                merchantId: merchantId
                            }
                        });
                    } else {
                        // Payment might still be processing or user dismissed early
                        // Payment might still be processing or user dismissed early
                        router.push({
                            pathname: '/order-success',
                            params: { orderId: order.id, pending: 'true', merchantId: merchantId }
                        });
                    }
                } else {
                    throw new Error("Payment URL not returned");
                }


            } else if (paymentMethod === 'credpal' || paymentMethod === 'credit_direct') {
                // CredPal and Credit Direct use JS widgets that only work on web
                // Open the web checkout page in an in-app browser with order context
                // The web checkout will detect orderId and resume the order for payment
                // Note: ogabassey.com is already the store domain, so just use /checkout
                const checkoutUrl = `${API_BASE}/checkout?orderId=${order.id}&gateway=${paymentMethod}`;

                // Open in-app browser (same experience as Paystack)
                await WebBrowser.openBrowserAsync(checkoutUrl, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                    dismissButtonStyle: 'done',
                });

                // After browser closes, verify payment status
                const verifyResponse = await fetch(`${API_BASE}/api/orders/${order.id}`);
                const orderStatus = await verifyResponse.json();

                if (orderStatus.payment_status === 'paid' || orderStatus.status === 'confirmed') {
                    clearCart();
                    router.push({
                        pathname: '/order-success',
                        params: { orderId: order.id, type: paymentMethod, merchantId: merchantId }
                    });
                } else {
                    // Payment might still be processing or user didn't complete
                    // Payment might still be processing or user didn't complete
                    router.push({
                        pathname: '/order-success',
                        params: { orderId: order.id, pending: 'true', merchantId: merchantId }
                    });
                }
                setIsSubmitting(false);
                return;

            } else {
                // Fallback for other payment methods - same flow
                const callbackUrl = Linking.createURL('payment-callback', {
                    queryParams: { orderId: order.id, gateway: paymentMethod || 'unknown' }
                });

                const initResponse = await fetch(`${API_BASE}/api/payments/initialize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_id: merchantId,
                        order_id: order.id,
                        amount: paymentAmount,
                        currency: 'NGN',
                        customer_email: formData.email,
                        customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
                        customer_phone: formData.phone,
                        gateway: paymentMethod,
                        callback_url: callbackUrl,
                    })
                });

                if (!initResponse.ok) {
                    // Automatically redirect to web for unsupported mobile payment methods (CredPal, etc.)
                    Linking.openURL(`${API_BASE}/checkout`);
                    setIsSubmitting(false);
                    return;
                }

                const paymentData = await initResponse.json();

                if (!initResponse.ok) {
                    throw new Error(paymentData.details || paymentData.error || "Payment initialization failed");
                }

                if (paymentData.authorization_url) {
                    const result = await WebBrowser.openAuthSessionAsync(paymentData.authorization_url, callbackUrl);

                    if (result.type === 'success') {
                        const verifyResponse = await fetch(`${API_BASE}/api/orders/${order.id}`);
                        const orderStatus = await verifyResponse.json();

                        if (orderStatus.payment_status === 'paid' || orderStatus.status === 'confirmed') {
                            clearCart();
                            router.push({
                                pathname: '/order-success',
                                params: { orderId: order.id, type: paymentMethod, merchantId: merchantId }
                            });
                        } else {
                            Alert.alert('Payment Processing', 'Your order is being processed.');
                        }
                    }
                }
            }

            setIsSubmitting(false);

        } catch (error) {
            console.error(error);
            Alert.alert('Checkout Failed', error instanceof Error ? error.message : 'Something went wrong');
            setIsSubmitting(false);
        }
    };

    if (items.length === 0) {
        return (
            <View className="flex-1 bg-white items-center justify-center p-6">
                <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                    <Ionicons name="cart-outline" size={32} color="#DC2626" />
                </View>
                <Text className="text-xl font-bold text-gray-900 mb-2">Your Cart is Empty</Text>
                <Text className="text-gray-500 text-center mb-6">
                    Looks like you haven't added anything to your cart yet.
                </Text>
                <Pressable
                    className="bg-red-600 px-8 py-3 rounded-full"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-bold">Start Shopping</Text>
                </Pressable>
            </View>
        );
    }

    const handleStepClick = (index: number) => {
        const targetStep = ['contact', 'delivery', 'payment'][index] as 'contact' | 'delivery' | 'payment';

        if (targetStep === 'contact') {
            setStep('contact');
        } else if (targetStep === 'delivery') {
            if (validateContact()) {
                setStep('delivery');
            }
        } else if (targetStep === 'payment') {
            // Check both contact and delivery before allowing jump to payment
            if (validateContact() && validateDelivery()) {
                setStep('payment');
            }
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />

            {/* Header with Safe Area Padding */}
            <View
                className="bg-white border-b border-gray-100 flex-row items-center justify-between px-4 py-3"
                style={{ paddingTop: insets.top }}
            >
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="p-2 -ml-2 rounded-full active:bg-gray-100">
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-lg font-bold text-gray-900 ml-2">Checkout</Text>
                </View>
                {/* Empty view for balance */}
                <View className="w-10" />
            </View>

            {/* Progress Steps - Modern 2025 Design */}
            <View className="bg-white px-4 py-5 flex-row justify-center items-center border-b border-gray-100 mb-2 gap-2">
                {['Contact', 'Delivery', 'Pay'].map((label, index) => {
                    const stepKeys = ['contact', 'delivery', 'payment'];
                    const isActive = step === stepKeys[index];
                    const currentIndex = step === 'contact' ? 0 : step === 'delivery' ? 1 : 2;
                    const isPast = currentIndex > index;

                    return (
                        <Pressable
                            key={label}
                            onPress={() => handleStepClick(index)}
                            className="flex-row items-center"
                        >
                            {/* Step Circle */}
                            <View className={`w-7 h-7 rounded-full items-center justify-center ${isPast
                                ? 'bg-green-500'
                                : isActive
                                    ? 'bg-red-600 border-2 border-red-200'
                                    : 'bg-gray-100 border border-gray-200'
                                }`}>
                                {isPast ? (
                                    <Ionicons name="checkmark" size={16} color="white" />
                                ) : (
                                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                        {index + 1}
                                    </Text>
                                )}
                            </View>
                            {/* Step Label */}
                            <Text className={`ml-1.5 text-xs font-semibold uppercase tracking-wide ${isPast ? 'text-green-600' : isActive ? 'text-gray-900' : 'text-gray-400'
                                }`}>
                                {label}
                            </Text>
                            {/* Connector Line */}
                            {index < 2 && (
                                <View className={`w-6 h-[2px] mx-2 rounded-full ${isPast ? 'bg-green-500' : 'bg-gray-200'}`} />
                            )}
                        </Pressable>
                    );
                })}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'contact' && (
                        <View>
                            <Text className="text-lg font-bold text-gray-900 mb-4">Contact Information</Text>

                            {/* Personal Details Card - Active styling */}
                            <View className="bg-white rounded-2xl p-5 mb-4 border-2 border-red-100 shadow-sm">
                                <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Personal Details *</Text>
                                <View className="flex-row gap-3 mb-3">
                                    <View className="flex-1">
                                        <TextInput
                                            value={formData.firstName}
                                            onChangeText={(v) => updateField('firstName', v)}
                                            placeholder="First Name"
                                            placeholderTextColor="#9CA3AF"
                                            className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <TextInput
                                            value={formData.lastName}
                                            onChangeText={(v) => updateField('lastName', v)}
                                            placeholder="Surname"
                                            placeholderTextColor="#9CA3AF"
                                            className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Email Card */}
                            <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
                                <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Email Address *</Text>
                                <TextInput
                                    value={formData.email}
                                    onChangeText={(v) => updateField('email', v)}
                                    placeholder="your@email.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200"
                                />
                            </View>

                            {/* Phone Card */}
                            <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
                                <PhoneInput
                                    value={formData.phone}
                                    onChangeText={(v: string) => updateField('phone', v)}
                                />
                            </View>
                        </View>
                    )}

                    {step === 'delivery' && (
                        <View>
                            <Text className="text-lg font-bold text-gray-900 mb-4">Delivery Method</Text>

                            {/* Delivery Tabs - Enhanced with icons */}
                            {/* NOTE: Using inline styles for shadow to avoid NativeWind race condition with React Navigation */}
                            <View className="flex-row bg-gray-100 p-1.5 rounded-2xl mb-6 gap-1">
                                <Pressable
                                    onPress={() => updateField('deliveryMethod', 'door')}
                                    className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${formData.deliveryMethod === 'door' ? 'bg-white' : ''}`}
                                    style={formData.deliveryMethod === 'door' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    } : undefined}
                                >
                                    <Ionicons name="home-outline" size={16} color={formData.deliveryMethod === 'door' ? '#DC2626' : '#6B7280'} />
                                    <Text className={`text-sm font-semibold ${formData.deliveryMethod === 'door' ? 'text-gray-900' : 'text-gray-500'}`}>Door</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => updateField('deliveryMethod', 'pickup')}
                                    className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${formData.deliveryMethod === 'pickup' ? 'bg-white' : ''}`}
                                    style={formData.deliveryMethod === 'pickup' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    } : undefined}
                                >
                                    <Ionicons name="storefront-outline" size={16} color={formData.deliveryMethod === 'pickup' ? '#DC2626' : '#6B7280'} />
                                    <Text className={`text-sm font-semibold ${formData.deliveryMethod === 'pickup' ? 'text-gray-900' : 'text-gray-500'}`}>Pickup</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => updateField('deliveryMethod', 'airport')}
                                    className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${formData.deliveryMethod === 'airport' ? 'bg-white' : ''}`}
                                    style={formData.deliveryMethod === 'airport' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    } : undefined}
                                >
                                    <Ionicons name="airplane-outline" size={16} color={formData.deliveryMethod === 'airport' ? '#DC2626' : '#6B7280'} />
                                    <Text className={`text-sm font-semibold ${formData.deliveryMethod === 'airport' ? 'text-gray-900' : 'text-gray-500'}`}>Airport</Text>
                                </Pressable>
                            </View>

                            {/* Address Section - Always rendered but hidden if not 'door' to prevent unmounting crash */}
                            <View className={formData.deliveryMethod === 'door' ? '' : 'hidden'}>
                                {/* Address card needs higher z-index for dropdown to show above siblings */}
                                <View
                                    style={{ zIndex: 100 }}
                                    className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm"
                                >
                                    <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Street Address *</Text>
                                    <AddressAutocomplete
                                        value={formData.address}
                                        onChangeText={(v) => updateField('address', v)}
                                        onSelect={(place: PlaceDetails) => {
                                            if (place.city) updateField('city', place.city);
                                            if (place.state) updateField('state', place.state);
                                        }}
                                        placeholder="Start typing your address..."
                                        country="NG"
                                    />
                                </View>

                                <View className="flex-row gap-4">
                                    <View className="flex-1 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">City *</Text>
                                        <TextInput
                                            value={formData.city}
                                            onChangeText={(v) => updateField('city', v)}
                                            placeholder="City"
                                            placeholderTextColor="#9CA3AF"
                                            className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200"
                                        />
                                    </View>
                                    <View className="flex-1 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">State *</Text>
                                        <TextInput
                                            value={formData.state}
                                            onChangeText={(v) => updateField('state', v)}
                                            placeholder="State"
                                            placeholderTextColor="#9CA3AF"
                                            className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Shipping Quotes Section - Show when Door delivery and address is complete */}
                            {formData.deliveryMethod === 'door' && formData.address.trim() && formData.city.trim() && formData.state.trim() && (
                                <View className="mt-4">
                                    <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Select Shipping Option</Text>

                                    {isLoadingQuotes && (
                                        <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center">
                                            <ActivityIndicator size="large" color="#DC2626" />
                                            <Text className="text-gray-500 mt-3">Fetching shipping options...</Text>
                                        </View>
                                    )}

                                    {quotesError && !isLoadingQuotes && (
                                        <View className="bg-red-50 rounded-2xl p-4 border border-red-200">
                                            <Text className="text-red-700 text-center">{quotesError}</Text>
                                            <Pressable onPress={fetchShippingQuotes} className="mt-3 bg-red-600 py-2 px-4 rounded-lg self-center">
                                                <Text className="text-white font-semibold">Retry</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    {!isLoadingQuotes && !quotesError && shippingQuotes.length > 0 && (
                                        <View className="gap-3">
                                            {shippingQuotes.map((quote) => (
                                                <Pressable
                                                    key={quote.id}
                                                    onPress={() => setSelectedQuoteId(quote.id)}
                                                    className={`bg-white rounded-2xl p-4 border flex-row items-center justify-between ${selectedQuoteId === quote.id ? 'border-red-600 bg-red-50' : 'border-gray-200'
                                                        }`}
                                                    style={selectedQuoteId === quote.id ? {
                                                        shadowColor: '#DC2626',
                                                        shadowOffset: { width: 0, height: 2 },
                                                        shadowOpacity: 0.1,
                                                        shadowRadius: 4,
                                                        elevation: 2,
                                                    } : undefined}
                                                >
                                                    <View className="flex-row items-center gap-3">
                                                        <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selectedQuoteId === quote.id ? 'border-red-600' : 'border-gray-300'
                                                            }`}>
                                                            {selectedQuoteId === quote.id && (
                                                                <View className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                                            )}
                                                        </View>
                                                        <View>
                                                            <Text className={`font-bold ${selectedQuoteId === quote.id ? 'text-gray-900' : 'text-gray-700'}`}>
                                                                {quote.carrierName || quote.displayName}
                                                            </Text>
                                                            <Text className="text-xs text-gray-500">
                                                                {quote.estimatedDays} day{quote.estimatedDays !== 1 ? 's' : ''} delivery
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text className={`font-bold text-lg ${selectedQuoteId === quote.id ? 'text-red-600' : 'text-gray-700'}`}>
                                                        ₦{quote.price.toLocaleString()}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}

                                    {!isLoadingQuotes && !quotesError && shippingQuotes.length === 0 && (
                                        <View className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                            <Text className="text-gray-500 text-center">Enter your complete address to see shipping options</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {formData.deliveryMethod === 'pickup' && (
                                <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center justify-center py-10 shadow-sm">
                                    <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                                        <Ionicons name="storefront" size={32} color="#DC2626" />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900 mb-2">Pickup at Store</Text>
                                    <Text className="text-center text-gray-600 px-4 leading-5">
                                        1st Floor Taiyelolu Towers{'\n'}
                                        2 Olaide Tomori Street{'\n'}
                                        Ikeja, Lagos, Nigeria
                                    </Text>
                                </View>
                            )}

                            {formData.deliveryMethod === 'airport' && (
                                <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center shadow-sm">
                                    <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                                        <Ionicons name="airplane" size={32} color="#DC2626" />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900 mb-2">Airport Service</Text>
                                    <Text className="text-center text-gray-600 mb-6 px-2">
                                        Choose pickup from our kiosk or delivery to your terminal.
                                    </Text>
                                    <View className="flex-row gap-3 w-full">
                                        <Pressable
                                            onPress={() => updateField('airportType', 'pickup')}
                                            className={`flex-1 py-4 px-2 rounded-xl border items-center ${formData.airportType === 'pickup' ? 'bg-red-50 border-red-600' : 'bg-gray-50 border-gray-200'}`}
                                        >
                                            <Text className={`font-bold text-md mb-1 ${formData.airportType === 'pickup' ? 'text-red-700' : 'text-gray-700'}`}>Pickup</Text>
                                            <Text className={`text-xs ${formData.airportType === 'pickup' ? 'text-red-600/80' : 'text-gray-500'}`}>₦20,000</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => updateField('airportType', 'delivery')}
                                            className={`flex-1 py-4 px-2 rounded-xl border items-center ${formData.airportType === 'delivery' ? 'bg-red-50 border-red-600' : 'bg-gray-50 border-gray-200'}`}
                                        >
                                            <Text className={`font-bold text-md mb-1 ${formData.airportType === 'delivery' ? 'text-red-700' : 'text-gray-700'}`}>Delivery</Text>
                                            <Text className={`text-xs ${formData.airportType === 'delivery' ? 'text-red-600/80' : 'text-gray-500'}`}>₦25,000</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {step === 'payment' && (
                        <View>
                            <Text className="text-lg font-bold text-gray-900 mb-4">Summary & Payment</Text>

                            <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-6 shadow-sm">
                                <Text className="font-bold text-gray-900 mb-3">Order Summary</Text>
                                {(items || []).map((item) => (
                                    <View key={item.id} className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600 flex-1 mr-2" numberOfLines={1}>
                                            {item.quantity}x {item.name}
                                        </Text>
                                        <Text className="text-gray-900 font-medium">₦{(item.price * item.quantity).toLocaleString()}</Text>
                                    </View>
                                ))}
                                <View className="h-[1px] bg-gray-100 my-3" />
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-500">Subtotal</Text>
                                    <Text className="text-gray-900">₦{cartTotal.toLocaleString()}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-500">Delivery</Text>
                                    <Text className="text-gray-900">{deliveryCost === 0 ? 'Free' : `₦${deliveryCost.toLocaleString()}`}</Text>
                                </View>
                                <View className="flex-row justify-between mt-2 pt-2 border-t border-dashed border-gray-200">
                                    <Text className="font-bold text-gray-900 text-lg">Total</Text>
                                    <Text className="font-bold text-red-600 text-lg">₦{total.toLocaleString()}</Text>
                                </View>
                            </View>

                            {/* Payment Tab Selector */}
                            {/* NOTE: Using inline styles for shadow to avoid NativeWind race condition with React Navigation */}
                            <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                                <Pressable
                                    onPress={() => { setPaymentTab('full'); setPaymentMethod(''); }}
                                    className={`flex-1 py-2.5 rounded-lg items-center ${paymentTab === 'full' ? 'bg-white' : ''}`}
                                    style={paymentTab === 'full' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 2,
                                        elevation: 1,
                                    } : undefined}
                                >
                                    <Text className={`font-semibold text-sm ${paymentTab === 'full' ? 'text-gray-900' : 'text-gray-500'}`}>Pay in Full</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => { setPaymentTab('installments'); setPaymentMethod(''); }}
                                    className={`flex-1 py-2.5 rounded-lg items-center ${paymentTab === 'installments' ? 'bg-white' : ''}`}
                                    style={paymentTab === 'installments' ? {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 2,
                                        elevation: 1,
                                    } : undefined}
                                >
                                    <Text className={`font-semibold text-sm ${paymentTab === 'installments' ? 'text-gray-900' : 'text-gray-500'}`}>Installments</Text>
                                </Pressable>
                            </View>

                            <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Select Payment Method</Text>

                            {/* Full Payment Options */}
                            {paymentTab === 'full' && (
                                <View className="gap-3">
                                    {/* Paystack */}
                                    <Pressable
                                        onPress={() => setPaymentMethod('paystack')}
                                        className={`p-4 rounded-xl border-2 flex-row items-center ${paymentMethod === 'paystack' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                                    >
                                        <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'paystack' ? 'border-red-600' : 'border-gray-400'}`}>
                                            {paymentMethod === 'paystack' && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">Paystack</Text>
                                            <Text className="text-xs text-gray-500">Cards, Bank Transfer, USSD</Text>
                                        </View>
                                    </Pressable>

                                    {/* Korapay - Hidden to match web (disabled) */}
                                    {/* <Pressable 
                                        onPress={() => setPaymentMethod('korapay')}
                                        className={`p-4 rounded-xl border-2 flex-row items-center ${paymentMethod === 'korapay' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                                    >
                                        <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'korapay' ? 'border-red-600' : 'border-gray-400'}`}>
                                            {paymentMethod === 'korapay' && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">Korapay</Text>
                                            <Text className="text-xs text-gray-500">Cards, Bank Transfer</Text>
                                        </View>
                                    </Pressable> */}

                                    {/* Crypto */}
                                    <Pressable
                                        onPress={() => setPaymentMethod('juicyway')}
                                        className={`p-4 rounded-xl border-2 flex-row items-center ${paymentMethod === 'juicyway' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                                    >
                                        <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'juicyway' ? 'border-red-600' : 'border-gray-400'}`}>
                                            {paymentMethod === 'juicyway' && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">Pay with Crypto</Text>
                                            <Text className="text-xs text-gray-500">USDT, USDC (Juicyway)</Text>
                                        </View>
                                        <View className="bg-purple-100 px-2 py-1 rounded">
                                            <Text className="text-xs font-bold text-purple-700">NEW</Text>
                                        </View>
                                    </Pressable>
                                </View>
                            )}

                            {/* Installment Options */}
                            {paymentTab === 'installments' && (
                                <View className="gap-3">
                                    {/* CredPal */}
                                    <Pressable
                                        onPress={() => setPaymentMethod('credpal')}
                                        className={`p-4 rounded-xl border-2 flex-row items-center ${paymentMethod === 'credpal' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                                    >
                                        <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'credpal' ? 'border-red-600' : 'border-gray-400'}`}>
                                            {paymentMethod === 'credpal' && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">CredPal</Text>
                                            <Text className="text-xs text-gray-500">Buy now, pay later</Text>
                                        </View>
                                    </Pressable>

                                    {/* Credit Direct */}
                                    <Pressable
                                        onPress={() => setPaymentMethod('credit_direct')}
                                        className={`p-4 rounded-xl border-2 flex-row items-center ${paymentMethod === 'credit_direct' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
                                    >
                                        <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'credit_direct' ? 'border-red-600' : 'border-gray-400'}`}>
                                            {paymentMethod === 'credit_direct' && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-gray-900">Credit Direct</Text>
                                            <Text className="text-xs text-gray-500">Flexible payment plans</Text>
                                        </View>
                                    </Pressable>

                                    {/* Installments Info */}
                                    <View className="bg-blue-50 p-4 rounded-xl">
                                        <Text className="text-blue-800 text-xs text-center">
                                            Split your payment into easy monthly installments. Subject to approval.
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Security Notice */}
                            {paymentMethod && (
                                <View className="bg-yellow-50 p-4 rounded-xl mt-4">
                                    <Text className="text-yellow-800 text-xs text-center">
                                        🔒 Secure payment processing. Your data is encrypted.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Action Bar */}
            <View className="bg-white p-4 border-t border-gray-100" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-500 text-sm">Total Amount</Text>
                    <Text className="text-xl font-bold text-red-600">₦{total.toLocaleString()}</Text>
                </View>

                {step === 'payment' ? (
                    <Pressable
                        onPress={handlePlaceOrder}
                        disabled={isSubmitting || !paymentMethod}
                        className={`py-4 rounded-full flex-row justify-center items-center ${isSubmitting || !paymentMethod ? 'bg-gray-300' : 'bg-red-600'
                            }`}
                    >
                        {isSubmitting ? (
                            <Text className="text-white font-bold text-lg">Processing...</Text>
                        ) : !paymentMethod ? (
                            <Text className="text-gray-500 font-bold text-lg">Select Payment Method</Text>
                        ) : (
                            <>
                                <Text className="text-white font-bold text-lg mr-2">Pay Now</Text>
                                <Ionicons name="lock-closed" size={20} color="white" />
                            </>
                        )}
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={handleNext}
                        className="bg-red-600 py-4 rounded-full flex-row justify-center items-center shadow-red-200 shadow-lg"
                    >
                        <Text className="text-white font-bold text-lg mr-2">Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </Pressable>
                )}
            </View>

            {/* Crypto Payment Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={cryptoModalVisible}
                onRequestClose={() => setCryptoModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/60">
                    <View className="bg-white rounded-t-3xl p-6 pb-12">
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-6" />

                        <Text className="text-xl font-bold text-gray-900 text-center mb-2">Complete Crypto Payment</Text>
                        <Text className="text-gray-500 text-center mb-6">
                            Send the exact amount to the wallet address below.
                        </Text>

                        {/* Network Selector */}
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">Select Network</Text>
                        <View className="flex-row gap-2 mb-6">
                            {(['TRX', 'ETH', 'MATIC'] as const).map((network) => (
                                <Pressable
                                    key={network}
                                    onPress={() => {
                                        if (network !== cryptoNetwork) {
                                            setCryptoNetwork(network);
                                            // Re-initialize payment with new network
                                            setCryptoModalVisible(false);
                                            Alert.alert(
                                                'Change Network',
                                                `Switch to ${network === 'TRX' ? 'Tron (TRC20)' : network === 'ETH' ? 'Ethereum (ERC20)' : 'Polygon'} network?`,
                                                [
                                                    { text: 'Cancel', style: 'cancel', onPress: () => setCryptoModalVisible(true) },
                                                    {
                                                        text: 'Switch',
                                                        onPress: () => {
                                                            setCryptoNetwork(network);
                                                            handlePlaceOrder(); // Re-trigger with new network
                                                        }
                                                    }
                                                ]
                                            );
                                        }
                                    }}
                                    className={`flex-1 py-3 px-4 rounded-xl border-2 items-center ${cryptoDetails?.chain === network || (cryptoDetails?.chain === 'TRX' && network === 'TRX')
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 bg-gray-50'
                                        }`}
                                >
                                    <Text className={`font-bold ${cryptoDetails?.chain === network || (cryptoDetails?.chain === 'TRX' && network === 'TRX')
                                        ? 'text-orange-600'
                                        : 'text-gray-600'
                                        }`}>
                                        {network === 'TRX' ? 'TRC20' : network === 'ETH' ? 'ERC20' : 'Polygon'}
                                    </Text>
                                    <Text className="text-xs text-gray-400">
                                        {network === 'TRX' ? '~1 min' : network === 'ETH' ? '~15 min' : '~2 min'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Amount Display */}
                        <View className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6 items-center">
                            <Text className="text-gray-500 text-sm mb-1">Amount to Send</Text>
                            <Text className="text-3xl font-bold text-orange-600 mb-1">
                                {((cryptoDetails?.amount || 0) / 100).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })} {cryptoDetails?.currency}
                            </Text>
                            <Text className="text-xs text-gray-500">
                                ≈ ₦{(cryptoDetails?.ngnAmount || 0).toLocaleString()}
                            </Text>
                        </View>

                        {/* Wallet Address */}
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">Wallet Address</Text>
                        <Pressable
                            onPress={async () => {
                                if (cryptoDetails?.address) {
                                    await Clipboard.setStringAsync(cryptoDetails.address);
                                    Alert.alert('Copied', 'Address copied to clipboard');
                                }
                            }}
                            className="bg-gray-100 p-4 rounded-xl flex-row items-center justify-between mb-6 border border-gray-200"
                        >
                            <Text className="text-gray-800 font-mono flex-1 mr-4 text-sm" numberOfLines={2}>
                                {cryptoDetails?.address}
                            </Text>
                            <View className="bg-white p-2 rounded-lg shadow-sm">
                                <Ionicons name="copy-outline" size={20} color="#374151" />
                            </View>
                        </Pressable>

                        {/* Warning */}
                        <View className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mb-6 flex-row items-center">
                            <Ionicons name="warning-outline" size={20} color="#CA8A04" />
                            <Text className="text-yellow-700 text-xs ml-2 flex-1">
                                Only send USDT on the selected network. Sending other tokens will result in loss of funds.
                            </Text>
                        </View>

                        {/* Actions */}
                        <View className="gap-3">
                            <Pressable
                                onPress={() => {
                                    setCryptoModalVisible(false);
                                    clearCart();
                                    router.push({
                                        pathname: '/order-success',
                                        params: {
                                            orderId: cryptoDetails?.orderId,
                                            type: 'crypto',
                                            merchantId: merchantId,
                                            pending: 'true'
                                        }
                                    });
                                }}
                                className="bg-red-600 w-full py-4 rounded-full items-center"
                            >
                                <Text className="text-white font-bold text-lg">I've Sent the Payment</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setCryptoModalVisible(false)}
                                className="w-full py-4 rounded-full items-center"
                            >
                                <Text className="text-gray-500 font-bold text-lg">Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
