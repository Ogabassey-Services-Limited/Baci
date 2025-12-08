"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, Truck, Plane, Building2, Wallet, CreditCard, FileText, ChevronRight, CheckCircle2, ShieldCheck, Info, Plus, AlertCircle, Share2, Mail, Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface SavedAddress {
    id: number;
    label: string;
    address: string;
    phone: string;
    isDefault: boolean;
}

export const CheckoutPage: React.FC = () => {
    const { cart, cartTotal, clearCart } = useCart();
    const merchantContext = useMerchantSafe();
    const merchant = merchantContext?.merchant;
    const router = useRouter();
    const searchParams = useSearchParams();

    // Customer form state
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Retrieve gift data if passed from cart
    const giftWrappingCost = Number(searchParams.get('giftWrappingCost')) || 0;

    // Mock Saved Addresses
    const [addresses, setAddresses] = useState<SavedAddress[]>([
        { id: 1, label: "Home", address: "2 Olaide Tomori St, Ikeja, Lagos", phone: "+234 814 697 8921", isDefault: true },
        { id: 2, label: "Office", address: "Tech Hub, 45 Admiralty Way, Lekki, Lagos", phone: "+234 800 123 4567", isDefault: false },
    ]);

    const [selectedAddressId, setSelectedAddressId] = useState<number>(1);
    const [isNewAddressMode, setIsNewAddressMode] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'door' | 'airport'>('door');

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('');
    const [payWithWallet, setPayWithWallet] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Pay For Me State
    const [payForMeDetails, setPayForMeDetails] = useState({ name: '', contact: '', note: '' });

    useEffect(() => {
        window.scrollTo(0, 0);
        if (cart.length === 0) {
            router.push('/cart');
        }
    }, [cart, router]);

    // Date Calculation for Door Delivery
    const getDeliveryDateRange = () => {
        const today = new Date();
        const start = new Date(today); start.setDate(today.getDate() + 1);
        const end = new Date(today); end.setDate(today.getDate() + 3);

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        return `${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
    };

    const deliveryCost = deliveryMethod === 'pickup' ? 0 : deliveryMethod === 'door' ? 2500 : 5000;
    const total = cartTotal + deliveryCost + giftWrappingCost;

    // Wallet feature disabled (future integration)
    const walletAmountUsed = 0;
    const remainingAmount = total - walletAmountUsed;

    const handlePlaceOrder = async () => {
        if (!merchant?.id) {
            alert('Merchant context not available. Please try again.');
            return;
        }

        if (!customerEmail || !customerName) {
            alert('Please fill in your name and email.');
            return;
        }

        setIsProcessing(true);

        const selectedAddress = addresses.find(a => a.id === selectedAddressId);
        const shippingAddressData = {
            address: selectedAddress?.address || 'Address not provided',
            phone: customerPhone || selectedAddress?.phone || '',
        };

        // Prepare order items for API
        const orderItems = cart.map(item => ({
            product_id: String(item.id),
            name: item.name,
            quantity: item.quantity,
            price: item.negotiatedPrice || item.price,
            value: (item.negotiatedPrice || item.price) * item.quantity,
        }));

        try {
            // 1. Create order in database via API
            const orderResponse = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchant_id: merchant.id,
                    customer_email: customerEmail,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    items: orderItems,
                    subtotal: cartTotal,
                    shipping_fee: deliveryCost,
                    payment_method: paymentMethod === 'paystack' ? 'card' : paymentMethod === 'invoice' ? 'invoice' : 'pod',
                    payment_status: 'unpaid',
                    shipping_status: 'pending',
                    shipping_address: shippingAddressData,
                    source: 'online_store',
                }),
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json();
                throw new Error(errorData.error || 'Failed to create order');
            }

            const { order } = await orderResponse.json();

            // 2. Handle payment based on method
            if (paymentMethod === 'paystack') {
                // Initialize payment via API (creates transaction record for webhook)
                const paymentResponse = await fetch('/api/payments/initialize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_id: merchant.id,
                        order_id: order.id,
                        amount: total,
                        currency: 'NGN',
                        customer_email: customerEmail,
                        customer_name: customerName,
                    }),
                });

                if (!paymentResponse.ok) {
                    const errorData = await paymentResponse.json();
                    throw new Error(errorData.error || 'Payment initialization failed');
                }

                const paymentResult = await paymentResponse.json();

                if (paymentResult.success && paymentResult.authorization_url) {
                    // Clear cart before redirect
                    clearCart();
                    // Redirect to payment gateway
                    window.location.href = paymentResult.authorization_url;
                    return;
                } else {
                    throw new Error('Payment initialization failed');
                }
            } else if (paymentMethod === 'invoice') {
                // Invoice/Pay Later - order created, redirect to success
                clearCart();
                router.push(`/order-success?type=invoice&orderId=${order.id}`);
            } else if (paymentMethod === 'payforme') {
                // Pay For Me - TODO: send payment link
                clearCart();
                router.push(`/order-success?type=payforme&orderId=${order.id}&payerName=${encodeURIComponent(payForMeDetails.name)}`);
            } else {
                // Default: POD or other
                clearCart();
                router.push(`/order-success?type=standard&orderId=${order.id}`);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert(error instanceof Error ? error.message : 'An error occurred. Please try again.');
            setIsProcessing(false);
        }
    };

    const isPayForMeValid = paymentMethod === 'payforme' ? (payForMeDetails.name && payForMeDetails.contact) : true;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">

                <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    Checkout
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT COLUMN: Input Forms */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* 0. Customer Information */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">1</div>
                                Contact Information
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Full Name *</label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Email Address *</label>
                                        <input
                                            type="email"
                                            value={customerEmail}
                                            onChange={(e) => setCustomerEmail(e.target.value)}
                                            placeholder="john@example.com"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="+234 800 000 0000"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 1. Delivery Address */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">2</div>
                                    Shipping Address
                                </h2>
                                <button
                                    onClick={() => setIsNewAddressMode(!isNewAddressMode)}
                                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                                >
                                    {isNewAddressMode ? "Select Saved Address" : <><Plus size={14} /> Add New Address</>}
                                </button>
                            </div>

                            {!isNewAddressMode ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {addresses.map(addr => (
                                        <label
                                            key={addr.id}
                                            className={`relative p-4 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-red-600 bg-red-50 ring-1 ring-red-100' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="radio"
                                                    name="address"
                                                    checked={selectedAddressId === addr.id}
                                                    onChange={() => setSelectedAddressId(addr.id)}
                                                    className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                                />
                                                <div className="text-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-900">{addr.label}</span>
                                                        {addr.isDefault && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Default</span>}
                                                    </div>
                                                    <p className="text-gray-600 leading-relaxed mb-1">{addr.address}</p>
                                                    <p className="text-gray-500 text-xs">{addr.phone}</p>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">First Name</label>
                                            <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Last Name</label>
                                            <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Address</label>
                                        <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" placeholder="Street address" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">City</label>
                                            <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">State</label>
                                            <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Phone</label>
                                        <input type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 text-sm" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Delivery Method */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">3</div>
                                Delivery Method
                            </h2>

                            <div className="space-y-3">
                                {/* Office Pickup */}
                                <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'pickup' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery"
                                        value="pickup"
                                        checked={deliveryMethod === 'pickup'}
                                        onChange={() => setDeliveryMethod('pickup')}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                    />
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Office Pickup</span>
                                            <span className="text-green-600 font-bold text-sm">Free</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Pick up from our Ikeja Store. Ready in 2 hours.</p>
                                    </div>
                                </label>

                                {/* Door Delivery */}
                                <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'door' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery"
                                        value="door"
                                        checked={deliveryMethod === 'door'}
                                        onChange={() => setDeliveryMethod('door')}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                    />
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-900 flex items-center gap-2"><Truck size={16} /> Door Delivery</span>
                                            <span className="font-bold text-gray-900 text-sm">₦2,500</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                                            <p>Delivery between <span className="font-bold text-gray-700">{getDeliveryDateRange()}</span>.</p>
                                            <p className="text-red-500 flex items-center gap-1"><Info size={10} /> If address is within Lagos delivery is between 24 - 48 working hours.</p>
                                        </div>
                                    </div>
                                </label>

                                {/* Airport Delivery */}
                                <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'airport' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery"
                                        value="airport"
                                        checked={deliveryMethod === 'airport'}
                                        onChange={() => setDeliveryMethod('airport')}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                    />
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-900 flex items-center gap-2"><Plane size={16} /> Airport Delivery (Outside Lagos)</span>
                                            <span className="font-bold text-gray-900 text-sm">₦5,000</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Airport delivery within 24 working hours.</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 4. Payment Method */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">4</div>
                                Payment Method
                            </h2>

                            <div className="space-y-4">

                                {/* OTHER METHODS - Only show/enable if remaining amount exists */}
                                {remainingAmount > 0 && (
                                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="h-px bg-gray-200 flex-1"></span>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Payment for Remainder</span>
                                            <span className="h-px bg-gray-200 flex-1"></span>
                                        </div>

                                        {/* Pay Later */}
                                        <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'invoice' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="invoice"
                                                checked={paymentMethod === 'invoice'}
                                                onChange={() => setPaymentMethod('invoice')}
                                                className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                            />
                                            <div className="ml-4 flex-1">
                                                <span className="font-bold text-gray-900 flex items-center gap-2"><FileText size={16} /> Generate Invoice (Pay Later)</span>
                                                <p className="text-xs text-gray-500 mt-0.5">Receive an invoice now and pay via transfer later.</p>
                                            </div>
                                        </label>

                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Full Payment Options</p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Paystack */}
                                            <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'paystack' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <input
                                                    type="radio"
                                                    name="payment"
                                                    value="paystack"
                                                    checked={paymentMethod === 'paystack'}
                                                    onChange={() => setPaymentMethod('paystack')}
                                                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                                />
                                                <div className="ml-3 flex items-center gap-2">
                                                    <span className="font-bold text-sm text-gray-900">Pay with Paystack</span>
                                                    <CreditCard size={14} className="text-blue-600" />
                                                </div>
                                            </label>

                                            {/* Pay for Me */}
                                            <div className={`p-3 rounded-xl border transition-all ${paymentMethod === 'payforme' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="payment"
                                                        value="payforme"
                                                        checked={paymentMethod === 'payforme'}
                                                        onChange={() => setPaymentMethod('payforme')}
                                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                                    />
                                                    <div className="ml-3">
                                                        <span className="font-bold text-sm text-gray-900 flex items-center gap-2"><Share2 size={14} /> Pay For Me</span>
                                                        <p className="text-[10px] text-gray-500">Send payment link to someone else</p>
                                                    </div>
                                                </label>

                                                {/* Pay For Me Form */}
                                                {paymentMethod === 'payforme' && (
                                                    <div className="mt-3 pt-3 border-t border-red-100 space-y-3 animate-in fade-in slide-in-from-top-1">
                                                        <div>
                                                            <input
                                                                type="text"
                                                                placeholder="Payer's Name"
                                                                value={payForMeDetails.name}
                                                                onChange={(e) => setPayForMeDetails({ ...payForMeDetails, name: e.target.value })}
                                                                className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="text"
                                                                placeholder="Payer's Email or Phone"
                                                                value={payForMeDetails.contact}
                                                                onChange={(e) => setPayForMeDetails({ ...payForMeDetails, contact: e.target.value })}
                                                                className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="text"
                                                                placeholder="Short note (Optional)"
                                                                value={payForMeDetails.note}
                                                                onChange={(e) => setPayForMeDetails({ ...payForMeDetails, note: e.target.value })}
                                                                className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Installment Payment Options</p>

                                        <div className="grid grid-cols-2 gap-3">
                                            {['CredPal', 'CreditDirect', 'Klump', 'Korapay'].map((provider) => (
                                                <label key={provider} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod === provider.toLowerCase() ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                                    <input
                                                        type="radio"
                                                        name="payment"
                                                        value={provider.toLowerCase()}
                                                        checked={paymentMethod === provider.toLowerCase()}
                                                        onChange={() => setPaymentMethod(provider.toLowerCase())}
                                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                                                    />
                                                    <div className="ml-3">
                                                        <span className="font-bold text-sm text-gray-900">Pay with {provider}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Order Summary */}
                    <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

                            {/* Items List (Collapsed View) */}
                            <div className="space-y-4 mb-6 max-h-[200px] overflow-y-auto pr-1">
                                {cart.map((item) => (
                                    <div key={item.cartItemId} className="flex gap-3">
                                        <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 p-1 flex-shrink-0">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.name}</p>
                                            <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
                                                <span>Qty: {item.quantity}</span>
                                                <span>₦{(item.negotiatedPrice || item.price).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-dashed border-gray-200 my-4"></div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-gray-600 text-sm">
                                    <span>Subtotal</span>
                                    <span>₦{cartTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-gray-600 text-sm">
                                    <span>Delivery</span>
                                    <span className={deliveryCost === 0 ? 'text-green-600 font-bold' : 'text-gray-900'}>
                                        {deliveryCost === 0 ? 'Free' : `₦${deliveryCost.toLocaleString()}`}
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

                                <div className="border-t border-dashed border-gray-200 my-2"></div>

                                {/* Total or Amount Due */}
                                <div className="flex justify-between text-gray-900 font-bold text-lg">
                                    <span>{remainingAmount > 0 && payWithWallet ? "Amount Due" : "Total"}</span>
                                    <span>₦{remainingAmount.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={handlePlaceOrder}
                                disabled={isProcessing || (remainingAmount > 0 && !paymentMethod) || (paymentMethod === 'payforme' && !isPayForMeValid)}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-200 active:scale-[0.98]"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" /> : (
                                    paymentMethod === 'invoice' ? 'Generate Invoice' :
                                        paymentMethod === 'payforme' ? 'Send Payment Link' :
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
            </div>
        </div>
    );
};
