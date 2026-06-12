import { toast } from '@/hooks/use-toast';
import type {
  CryptoChain,
  CryptoCurrency,
  CryptoPaymentData,
  PendingCryptoOrder,
} from '../types';

const MAX_ADDRESS_POLLS = 45; // ~90 seconds with 2s intervals
const ADDRESS_POLL_INTERVAL = 2000;

interface CryptoAddressResult {
  address: string;
  chain?: string;
  currency?: string;
  qrcode?: string;
}

async function pollForCryptoAddress(
  sessionId: string,
  paymentId: string
): Promise<CryptoAddressResult | null> {
  const id = paymentId || sessionId;

  for (let attempt = 0; attempt < MAX_ADDRESS_POLLS; attempt++) {
    await new Promise((r) => setTimeout(r, ADDRESS_POLL_INTERVAL));

    try {
      const res = await fetch(
        `/api/payments/status?gateway=juicyway&session_id=${sessionId}&payment_id=${id}&check_address=true`
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (data.crypto_address?.address) {
        return data.crypto_address;
      }

      // Stop if the payment itself failed
      if (data.status === 'failed' || data.status === 'cancelled') {
        return null;
      }
    } catch {
      // Network error — keep trying
    }
  }
  return null;
}

interface RunCryptoPaymentInitializationOptions {
  merchantId: string;
  pendingCryptoOrder: PendingCryptoOrder;
  selectedCryptoChain: CryptoChain;
  selectedCryptoCurrency: CryptoCurrency;
  setShowCryptoSelector: (show: boolean) => void;
  setCryptoPaymentData: (data: CryptoPaymentData) => void;
  setIsInitializingCrypto: (isInitializing: boolean) => void;
}

/**
 * Module-scope crypto payment initialization flow.
 *
 * Hoisted out of `useCryptoPayment` because `try/finally` and
 * throw-inside-`try/catch` statements in a hook body are React Compiler
 * "Todo" bailouts that disable memoization for the whole hook.
 */
export async function runCryptoPaymentInitialization({
  merchantId,
  pendingCryptoOrder,
  selectedCryptoChain,
  selectedCryptoCurrency,
  setShowCryptoSelector,
  setCryptoPaymentData,
  setIsInitializingCrypto,
}: RunCryptoPaymentInitializationOptions): Promise<void> {
  setIsInitializingCrypto(true);
  try {
    const paymentResponse = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        order_id: pendingCryptoOrder.orderId,
        currency: 'NGN',
        customer_email: pendingCryptoOrder.customerEmail,
        customer_name: pendingCryptoOrder.customerName,
        customer_phone: pendingCryptoOrder.customerPhone,
        gateway: 'juicyway',
        billing_address: pendingCryptoOrder.billingAddress,
        items: pendingCryptoOrder.items,
        crypto_chain: selectedCryptoChain,
        crypto_currency: selectedCryptoCurrency,
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      throw new Error(
        errorData.details || errorData.error || 'Payment initialization failed'
      );
    }

    const paymentResult = await paymentResponse.json();

    if (paymentResult.success && paymentResult.crypto_payment) {
      setShowCryptoSelector(false);

      const cryptoAmount = paymentResult.crypto_payment.amount / 100;
      const sessionId = paymentResult.session_id || '';
      const paymentId = paymentResult.crypto_payment.payment_id || '';

      // If the address is ready, set it immediately
      if (
        paymentResult.crypto_payment.address &&
        !paymentResult.crypto_address_pending
      ) {
        setCryptoPaymentData({
          address: paymentResult.crypto_payment.address,
          chain: paymentResult.crypto_payment.chain,
          currency: paymentResult.crypto_payment.currency,
          amount: cryptoAmount,
          confirmation_time: paymentResult.crypto_payment.confirmation_time,
          orderId: pendingCryptoOrder.orderId,
          reference: paymentResult.reference,
          sessionId,
          paymentId,
          qrcode: paymentResult.crypto_payment.qrcode,
          trackingToken: pendingCryptoOrder.trackingToken,
        });
      } else {
        // Address still being generated — poll the status endpoint
        const address = await pollForCryptoAddress(sessionId, paymentId);
        if (address) {
          setCryptoPaymentData({
            address: address.address,
            chain: address.chain || paymentResult.crypto_payment.chain,
            currency: address.currency || paymentResult.crypto_payment.currency,
            amount: cryptoAmount,
            confirmation_time: paymentResult.crypto_payment.confirmation_time,
            orderId: pendingCryptoOrder.orderId,
            reference: paymentResult.reference,
            sessionId,
            paymentId,
            qrcode: address.qrcode,
            trackingToken: pendingCryptoOrder.trackingToken,
          });
        } else {
          throw new Error(
            'Crypto wallet address generation timed out. Please try again.'
          );
        }
      }
    } else {
      throw new Error('Failed to generate crypto payment address');
    }
  } catch (error) {
    console.error('Crypto payment initialization error:', error);
    toast({
      title: 'Crypto Payment Failed',
      description:
        error instanceof Error
          ? error.message
          : 'Failed to initialize crypto payment',
      variant: 'destructive',
    });
  } finally {
    setIsInitializingCrypto(false);
  }
}
