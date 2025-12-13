/**
 * CredPal BNPL (Buy Now Pay Later) Integration
 * 
 * CredPal provides inline checkout via a JavaScript popup.
 * Docs: https://github.com/crednet/credpal-checkout-inline
 */

export interface CredPalCheckoutConfig {
    key: string;
    amount: number;
    product: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    onClose?: () => void;
    onLoad?: () => void;
    onError?: (error: { success: false; message: string }) => void;
    onSuccess?: (data: CredPalSuccessResponse) => void;
}

export interface CredPalSuccessResponse {
    order_no: string;
    item: string;
    amount: number;
    status: 'success' | 'pending';
    channel: string;
    customer: {
        full_name: string;
        email: string;
        phone_no: string;
    };
    created_at: string;
}

// CredPal SDK script URL
export const CREDPAL_SCRIPT_URL = 'https://corporate-loans.obs.sa-brazil-1.myhuaweicloud.com/minifiedJS/index.js';

/**
 * Get CredPal merchant key from environment
 */
export function getCredPalKey(): string {
    const key = process.env.NEXT_PUBLIC_CREDPAL_KEY;
    if (!key) {
        throw new Error('NEXT_PUBLIC_CREDPAL_KEY environment variable is not set');
    }
    return key;
}

/**
 * Check if CredPal is available in the browser
 */
export function isCredPalLoaded(): boolean {
    return typeof window !== 'undefined' && 'Checkout' in window;
}

/**
 * Dynamically load the CredPal script
 */
export function loadCredPalScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isCredPalLoaded()) {
            resolve();
            return;
        }

        const existingScript = document.querySelector(`script[src="${CREDPAL_SCRIPT_URL}"]`);
        if (existingScript) {
            // Script already loading, wait for it
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Failed to load CredPal script')));
            return;
        }

        const script = document.createElement('script');
        script.src = CREDPAL_SCRIPT_URL;
        script.type = 'text/javascript';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load CredPal script'));
        document.head.appendChild(script);
    });
}

/**
 * Initialize and open CredPal checkout popup
 */
export async function openCredPalCheckout(config: CredPalCheckoutConfig): Promise<void> {
    await loadCredPalScript();

    if (!isCredPalLoaded()) {
        throw new Error('CredPal SDK failed to load');
    }

    // Access the global Checkout class from the CredPal SDK
    const Checkout = (window as unknown as { Checkout: new (config: CredPalCheckoutConfig) => { setup: () => void; open: () => void; close: () => void } }).Checkout;

    const checkout = new Checkout({
        key: config.key,
        amount: config.amount,
        product: config.product,
        onClose: config.onClose || (() => console.log('CredPal widget closed')),
        onLoad: config.onLoad || (() => console.log('CredPal widget loaded')),
        onError: config.onError || ((error) => console.error('CredPal error:', error)),
        onSuccess: config.onSuccess || ((data) => console.log('CredPal success:', data)),
    });

    checkout.setup();
    checkout.open();
}

/**
 * Check if an order amount is eligible for CredPal BNPL
 * CredPal typically has minimum and maximum limits
 */
export function isCredPalEligible(
    amount: number,
    minAmount: number = 10000, // ₦10,000 minimum
    maxAmount: number = 5000000 // ₦5,000,000 maximum
): boolean {
    return amount >= minAmount && amount <= maxAmount;
}

/**
 * Calculate estimated monthly payment for CredPal BNPL
 * This is an approximation - actual rates depend on CredPal's assessment
 */
export function estimateMonthlyPayment(
    amount: number,
    months: number = 3,
    interestRate: number = 0.05 // 5% monthly interest approximation
): number {
    const totalWithInterest = amount * (1 + (interestRate * months));
    return Math.ceil(totalWithInterest / months);
}
