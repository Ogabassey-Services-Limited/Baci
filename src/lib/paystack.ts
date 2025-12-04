import { logger } from './logger';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_SECRET_KEY) {
    console.warn('PAYSTACK_SECRET_KEY is not defined');
}

export interface Bank {
    id: number;
    name: string;
    slug: string;
    code: string;
    longcode: string;
    gateway: string;
    pay_with_bank: boolean;
    active: boolean;
    is_deleted: boolean;
    country: string;
    currency: string;
    type: string;
}

export interface Subaccount {
    business_name: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
    description?: string;
    primary_contact_email?: string;
    primary_contact_name?: string;
    primary_contact_phone?: string;
    metadata?: Record<string, any>;
}

export interface SubaccountResponse {
    status: boolean;
    message: string;
    data: {
        id: number;
        subaccount_code: string;
        business_name: string;
        description: string;
        primary_contact_name: string;
        primary_contact_email: string;
        primary_contact_phone: string;
        percentage_charge: number;
        settlement_bank: string;
        account_number: string;
        [key: string]: any;
    };
}

/**
 * Fetch list of banks from Paystack
 */
export async function getBanks(country = 'nigeria'): Promise<Bank[]> {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=${country}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            next: { revalidate: 86400 }, // Cache for 24 hours
        } as RequestInit);

        if (!response.ok) {
            throw new Error(`Failed to fetch banks: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        logger.error({ message: 'Error fetching banks from Paystack', error: error as Error });
        return [];
    }
}

/**
 * Resolve account number to verify name
 */
export async function resolveAccountNumber(accountNumber: string, bankCode: string) {
    try {
        const response = await fetch(
            `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Could not resolve account number');
        }

        return data.data;
    } catch (error) {
        logger.error({ message: 'Error resolving account number', error: error as Error });
        throw error;
    }
}

/**
 * Create a subaccount for a merchant
 */
export async function createSubaccount(payload: Subaccount): Promise<SubaccountResponse['data']> {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/subaccount`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to create subaccount');
        }

        return data.data;
    } catch (error) {
        logger.error({ message: 'Error creating subaccount', error: error as Error });
        throw error;
    }
}

/**
 * Update a subaccount
 */
export async function updateSubaccount(subaccountCode: string, payload: Partial<Subaccount>) {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/subaccount/${subaccountCode}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to update subaccount');
        }

        return data.data;
    } catch (error) {
        logger.error({ message: 'Error updating subaccount', error: error as Error });
        throw error;
    }
}

// Platform fee percentage (2%) capped at ₦2,050
const PLATFORM_FEE_PERCENTAGE = 2;
const PLATFORM_FEE_CAP_NAIRA = 2050; // ₦2,050 cap
const PLATFORM_FEE_CAP_KOBO = PLATFORM_FEE_CAP_NAIRA * 100; // 205,000 kobo

export interface PaymentInitData {
    email: string;
    amount: number; // Amount in kobo (NGN smallest unit)
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, unknown>;
    subaccount?: string; // Subaccount code for split payments
    transaction_charge?: number; // Platform fee in kobo
    bearer?: 'account' | 'subaccount'; // Who bears the transaction charges
    channels?: Array<'card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer'>;
}

export interface PaymentInitResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

export interface PaymentVerificationResponse {
    id: number;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string;
    created_at: string;
    customer: {
        id: number;
        email: string;
        customer_code: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
    };
    metadata: Record<string, unknown>;
    fees: number;
    fees_split: {
        paystack: number;
        integration: number;
        subaccount: number;
    } | null;
}

/**
 * Initialize a Paystack transaction
 */
export async function initializeTransaction(
    payload: PaymentInitData
): Promise<PaymentInitResponse> {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to initialize transaction');
        }

        return data.data;
    } catch (error) {
        logger.error({ message: 'Error initializing Paystack transaction', error: error as Error });
        throw error;
    }
}

/**
 * Verify a Paystack transaction
 */
export async function verifyTransaction(reference: string): Promise<PaymentVerificationResponse> {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to verify transaction');
        }

        return data.data;
    } catch (error) {
        logger.error({ message: 'Error verifying Paystack transaction', error: error as Error });
        throw error;
    }
}

/**
 * Calculate platform fee for split payments
 * Platform takes 2%, capped at ₦2,050
 * Amount should be in kobo
 */
export function calculatePlatformFee(amountInKobo: number): {
    platformFee: number; // in kobo
    merchantAmount: number; // in kobo
    total: number; // in kobo
} {
    // Calculate 2% fee
    let platformFee = Math.round((amountInKobo * PLATFORM_FEE_PERCENTAGE) / 100);

    // Apply cap of ₦2,050 (205,000 kobo)
    platformFee = Math.min(platformFee, PLATFORM_FEE_CAP_KOBO);

    const merchantAmount = amountInKobo - platformFee;

    return {
        platformFee,
        merchantAmount,
        total: amountInKobo,
    };
}

/**
 * Get Paystack public key for frontend
 */
export function getPublicKey(): string {
    return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
}

export { PLATFORM_FEE_PERCENTAGE };
