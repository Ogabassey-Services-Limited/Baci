'use server';

import { initializeTransaction as paystackInitialize, type PaymentInitData, type PaymentInitResponse } from '@/lib/paystack';

interface InitPaymentParams {
    email: string;
    /** Amount in Naira (will be converted to kobo) */
    amountNaira: number;
    orderId: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
    subaccountCode?: string;
}

interface InitPaymentResult {
    success: boolean;
    authorizationUrl?: string;
    reference?: string;
    error?: string;
}

/**
 * Server Action to initialize a Paystack transaction.
 * This keeps the secret key on the server and returns the authorization URL.
 */
export async function initializePaystackPayment(
    params: InitPaymentParams
): Promise<InitPaymentResult> {
    try {
        const { email, amountNaira, orderId, callbackUrl, metadata, subaccountCode } = params;

        // Convert Naira to kobo (Paystack uses smallest currency unit)
        const amountKobo = Math.round(amountNaira * 100);

        const payload: PaymentInitData = {
            email,
            amount: amountKobo,
            reference: `${orderId}-${Date.now()}`,
            callback_url: callbackUrl,
            metadata: {
                order_id: orderId,
                ...metadata,
            },
            channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        };

        // Add subaccount for split payments if provided
        if (subaccountCode) {
            payload.subaccount = subaccountCode;
            payload.bearer = 'subaccount'; // Subaccount bears transaction fees
        }

        const result: PaymentInitResponse = await paystackInitialize(payload);

        return {
            success: true,
            authorizationUrl: result.authorization_url,
            reference: result.reference,
        };
    } catch (error) {
        console.error('Error initializing Paystack payment:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to initialize payment',
        };
    }
}
