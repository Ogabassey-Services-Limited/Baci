'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { openCreditDirectCheckout } from '@/lib/credit-direct-client';
import { openCredPalCheckout } from '@/lib/credpal';
import { apiPost } from '@/lib/api-client';
import { useMerchant } from '@/hooks/use-merchant-client';
import { CHECKOUT_PENDING_ORDER_STORAGE_KEY } from './checkout/pending-checkout-order';

const KLUMP_SCRIPT_URL = 'https://js.useklump.com/klump.js';
const KLUMP_TRANSACTION_ID_KEYS = [
    'klump_transaction_id',
    'klumpTransactionId',
    'checkout_transaction_id',
    'checkoutTransactionId',
    'transaction_id',
    'transactionId',
    'tx_ref',
    'txRef',
    'id',
] as const;

interface SearchParamReader {
    get: (name: string) => string | null;
}

interface KlumpRecordResponse {
    success?: boolean;
    error?: string;
}

declare global {
    interface Window {
        Klump?: new (config: {
            publicKey: string;
            data: {
                amount: number;
                currency: 'NGN';
                email?: string;
                first_name?: string;
                last_name?: string;
                phone?: string;
                merchant_reference: string;
                redirect_url: string;
                shipping_fee?: number;
                items: Array<{
                    name: string;
                    quantity: number;
                    unit_price: number;
                }>;
                meta_data: {
                    order_id: string;
                    source: 'baci-web';
                };
            };
            onSuccess?: (payload?: unknown) => void;
            onError?: (error: unknown) => void;
            onClose?: () => void;
            onLoad?: () => void;
            onOpen?: () => void;
        }) => unknown;
    }
}

function readSearchParam(
    searchParams: SearchParamReader,
    keys: readonly string[]
) {
    for (const key of keys) {
        const value = searchParams.get(key);
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function getKlumpTransactionId(searchParams: SearchParamReader) {
    return readSearchParam(searchParams, KLUMP_TRANSACTION_ID_KEYS);
}

function getKlumpPublicKey() {
    const key =
        process.env.NEXT_PUBLIC_KLUMP_PUBLIC_KEY ||
        process.env.NEXT_PUBLIC_KLUMP_KEY ||
        process.env.KLUMP_PUBLIC_KEY;

    if (!key) {
        throw new Error(
            'NEXT_PUBLIC_KLUMP_PUBLIC_KEY (or NEXT_PUBLIC_KLUMP_KEY) is not set'
        );
    }

    return key;
}

function loadKlumpScript() {
    return new Promise<void>((resolve, reject) => {
        if (typeof window !== 'undefined' && window.Klump) {
            resolve();
            return;
        }

        const existingScript = document.querySelector(
            `script[src="${KLUMP_SCRIPT_URL}"]`
        );
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () =>
                reject(new Error('Failed to load Klump script'))
            );
            return;
        }

        const script = document.createElement('script');
        script.src = KLUMP_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Klump script'));
        document.head.appendChild(script);
    });
}

function readPendingOrderSnapshot(orderId: string | null) {
    if (!orderId || typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = window.sessionStorage.getItem(
            CHECKOUT_PENDING_ORDER_STORAGE_KEY
        );
        if (!stored) {
            return null;
        }

        const pendingOrder = JSON.parse(stored) as {
            orderId?: string;
            trackingToken?: string;
            customerEmail?: string;
        };

        if (pendingOrder.orderId !== orderId) {
            return null;
        }

        return {
            trackingToken: pendingOrder.trackingToken || null,
            customerEmail: pendingOrder.customerEmail?.trim() || null,
        };
    } catch {
        return null;
    }
}

export function BnplLauncher() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { merchant, loading } = useMerchant();

    const orderId = searchParams.get('orderId');
    const gateway = searchParams.get('gateway') as
        | 'credit_direct'
        | 'credpal'
        | 'klump'
        | null;
    const klumpReference = searchParams.get('reference')?.trim() || null;
    const klumpCallback = searchParams.get('klump_callback') === '1';
    const klumpTransactionId = getKlumpTransactionId(searchParams);
    const trackingTokenParam =
        searchParams.get('trackingToken') ||
        searchParams.get('tracking_token') ||
        searchParams.get('token');
    const pendingOrderSnapshot = readPendingOrderSnapshot(orderId);
    const trackingToken = trackingTokenParam || pendingOrderSnapshot?.trackingToken || null;
    const lookupEmail =
        searchParams.get('email')?.trim() ||
        pendingOrderSnapshot?.customerEmail ||
        null;
    const merchantSlugParam =
        searchParams.get('merchant_slug') || searchParams.get('slug');

    const [status, setStatus] = useState<'loading' | 'processing' | 'error'>(
        'loading'
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (loading) return;

        const launchPayment = async () => {
            try {
                if (!orderId || !gateway) {
                    setStatus('error');
                    setErrorMessage('Missing order ID or gateway information.');
                    return;
                }

                setStatus('loading');
                setErrorMessage(null);

                if (gateway === 'klump' && klumpCallback) {
                    if (!klumpReference || !trackingToken) {
                        throw new Error('Missing Klump callback context.');
                    }

                    if (!klumpTransactionId) {
                        throw new Error(
                            'Klump checkout returned without a transaction id.'
                        );
                    }

                    const recordResponse = await apiPost<KlumpRecordResponse>(
                        '/api/payments/klump/record',
                        {
                            merchant_reference: klumpReference,
                            klump_transaction_id: klumpTransactionId,
                            tracking_token: trackingToken,
                        }
                    );

                    if (!recordResponse?.success) {
                        throw new Error(
                            recordResponse?.error ||
                                'Failed to record Klump transaction.'
                        );
                    }

                    const successQuery = new URLSearchParams({
                        orderId,
                        reference: klumpReference,
                    });
                    successQuery.set('trackingToken', trackingToken);
                    router.push(`/order-success?${successQuery.toString()}`);
                    return;
                }

                const slug = merchantSlugParam || merchant?.slug || 'ogabassey';
                const query = new URLSearchParams({ merchant_slug: slug });
                if (trackingToken) {
                    query.set('token', trackingToken);
                }
                if (lookupEmail) {
                    query.set('email', lookupEmail);
                }

                if (process.env.NODE_ENV === 'development') {
                    console.log(
                        `[BnplLauncher] Fetching order ${orderId} for merchant ${slug}`
                    );
                }
                const url = `/api/storefront/orders/${orderId}?${query.toString()}`;
                const res = await fetch(url);

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(
                        `[BnplLauncher] Fetch failed: ${res.status} ${errorText}`
                    );
                    throw new Error(
                        `Failed to fetch order details (Status: ${res.status})`
                    );
                }

                const order = await res.json();
                if (!order.items || order.items.length === 0) {
                    throw new Error('Order has no items.');
                }

                setStatus('processing');

                if (gateway === 'credit_direct') {
                    await openCreditDirectCheckout({
                        merchantSlug: merchant?.slug || 'ogabassey',
                        orderId: order.id,
                        amount: order.total,
                        customerEmail: order.customer_email,
                        customerPhone: order.customer_phone || '',
                        customerName: order.customer_name,
                        items: order.items.map(
                            (item: {
                                product_id?: string;
                                id?: string;
                                product_name?: string;
                                name?: string;
                                price: number;
                                quantity: number;
                            }) => ({
                                id: String(item.product_id || item.id),
                                name: item.product_name || item.name || '',
                                price: item.price,
                                quantity: item.quantity,
                            })
                        ),
                        onSuccess: (ref) => {
                            const successQuery = new URLSearchParams({
                                orderId: order.id,
                                reference: ref,
                            });
                            if (order.tracking_token) {
                                successQuery.set('trackingToken', order.tracking_token);
                            }
                            router.push(`/order-success?${successQuery.toString()}`);
                        },
                        onClose: () => {
                            setStatus('error');
                            setErrorMessage('Payment cancelled. Please try again.');
                        },
                        onError: (error) => {
                            console.error('Credit Direct Error:', error);
                            setStatus('error');
                            setErrorMessage(error);
                        },
                    });
                    return;
                }

                if (gateway === 'credpal') {
                    const { getCredPalKey } = await import('@/lib/credpal');
                    await openCredPalCheckout({
                        key: getCredPalKey(),
                        amount: order.total,
                        product: `Order #${order.id}`,
                        customerEmail: order.customer_email,
                        customerName: order.customer_name,
                        customerPhone: order.customer_phone,
                        onSuccess: (data) => {
                            const successQuery = new URLSearchParams({
                                orderId: order.id,
                                reference: data.order_no,
                            });
                            if (order.tracking_token) {
                                successQuery.set('trackingToken', order.tracking_token);
                            }
                            router.push(`/order-success?${successQuery.toString()}`);
                        },
                        onClose: () => {
                            setStatus('error');
                            setErrorMessage('Payment cancelled.');
                        },
                        onError: (error) => {
                            setStatus('error');
                            setErrorMessage(error.message);
                        },
                    });
                    return;
                }

                if (gateway === 'klump') {
                    if (!klumpReference || !trackingToken) {
                        throw new Error(
                            'Missing Klump reference or tracking token.'
                        );
                    }

                    await loadKlumpScript();

                    if (!window.Klump) {
                        throw new Error('Klump SDK failed to load');
                    }

                    const publicKey = getKlumpPublicKey();
                    const callbackQuery = new URLSearchParams({
                        gateway: 'klump',
                        klump_callback: '1',
                        merchant_slug: slug,
                        orderId: order.id,
                        reference: klumpReference,
                    });
                    callbackQuery.set('trackingToken', trackingToken);
                    if (lookupEmail) {
                        callbackQuery.set('email', lookupEmail);
                    }

                    const [first_name, ...rest] = (order.customer_name || '')
                        .trim()
                        .split(/\s+/);
                    const last_name = rest.join(' ');

                    new window.Klump({
                        publicKey,
                        data: {
                            amount: Number(order.total) || 0,
                            currency: 'NGN',
                            ...(order.customer_email ? { email: order.customer_email } : {}),
                            ...(first_name ? { first_name } : {}),
                            ...(last_name ? { last_name } : {}),
                            ...(order.customer_phone
                                ? { phone: order.customer_phone }
                                : {}),
                            merchant_reference: klumpReference,
                            redirect_url: `${window.location.origin}/${slug}/checkout/bnpl?${callbackQuery.toString()}`,
                            shipping_fee: Number(order.shipping_fee) || 0,
                            items: order.items.map(
                                (item: {
                                    name?: string;
                                    product_name?: string;
                                    price: number;
                                    quantity: number;
                                }) => ({
                                    name:
                                        item.product_name ||
                                        item.name ||
                                        'Order item',
                                    quantity: Math.max(
                                        1,
                                        Number(item.quantity) || 1
                                    ),
                                    unit_price: Number(item.price) || 0,
                                })
                            ),
                            meta_data: {
                                order_id: order.id,
                                source: 'baci-web',
                            },
                        },
                        onClose: () => {
                            setStatus('error');
                            setErrorMessage('Payment cancelled. Please try again.');
                        },
                        onError: (error) => {
                            setStatus('error');
                            setErrorMessage(
                                error instanceof Error
                                    ? error.message
                                    : 'Klump checkout failed.'
                            );
                        },
                    });
                    return;
                }

                throw new Error('Unsupported gateway for this launcher.');
            } catch (error) {
                console.error('BNPL Launch Error:', error);
                setStatus('error');
                setErrorMessage(
                    error instanceof Error ? error.message : 'Failed to launch payment.'
                );
            }
        };

        launchPayment();
    }, [
        orderId,
        gateway,
        merchant?.slug,
        merchantSlugParam,
        lookupEmail,
        loading,
        klumpCallback,
        klumpReference,
        klumpTransactionId,
        router,
        trackingToken,
    ]);

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Something went wrong
                    </h2>
                    <p className="text-gray-600 mb-6">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full mt-3 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-store-primary rounded-full border-t-transparent animate-spin"></div>
                    <ShieldCheck className="absolute inset-0 m-auto text-store-primary w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Secure Checkout
                </h1>
                <p className="text-gray-500">Launching payment gateway...</p>
                <p className="text-xs text-gray-400 mt-8">
                    Please do not close this window.
                </p>
            </div>
        </div>
    );
}
