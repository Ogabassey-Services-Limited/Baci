'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CryptoChain,
  CryptoCurrency,
  CryptoPaymentData,
  CryptoVerificationStatus,
  PendingCryptoOrder,
} from '../types';
import { CRYPTO_CHAIN_SUPPORT } from '../utils';
import { toast } from '@/hooks/use-toast';

interface UseCryptoPaymentOptions {
  merchantId: string | undefined;
  clearCheckoutSession: () => void;
  clearCart: () => void;
  routerPush: (url: string) => void;
  getHref: (path: string) => string;
}

export function useCryptoPayment({
  merchantId,
  clearCheckoutSession,
  clearCart,
  routerPush,
  getHref,
}: UseCryptoPaymentOptions) {
  const [cryptoPaymentData, setCryptoPaymentData] =
    useState<CryptoPaymentData | null>(null);
  const [isVerifyingCrypto, setIsVerifyingCrypto] = useState(false);
  const [cryptoVerificationStatus, setCryptoVerificationStatus] =
    useState<CryptoVerificationStatus>('idle');
  const [showCryptoSelector, setShowCryptoSelector] = useState(false);
  const [selectedCryptoChain, setSelectedCryptoChain] =
    useState<CryptoChain>('TRX');
  const [selectedCryptoCurrency, setSelectedCryptoCurrency] =
    useState<CryptoCurrency>('USDT');
  const [pendingCryptoOrder, setPendingCryptoOrder] =
    useState<PendingCryptoOrder | null>(null);
  const [isInitializingCrypto, setIsInitializingCrypto] = useState(false);

  const handleCryptoBack = () => {
    setCryptoPaymentData(null);
    setShowCryptoSelector(true);
  };

  const handleCryptoCurrencyChange = (currency: CryptoCurrency) => {
    setSelectedCryptoCurrency(currency);
    const supportedChains = CRYPTO_CHAIN_SUPPORT[currency];
    if (!supportedChains.includes(selectedCryptoChain)) {
      setSelectedCryptoChain(supportedChains[0]);
    }
  };

  const pollForCryptoAddress = async (
    sessionId: string,
    paymentId: string,
  ): Promise<{
    address: string;
    chain?: string;
    currency?: string;
    qrcode?: string;
  } | null> => {
    const MAX_ADDRESS_POLLS = 45; // ~90 seconds with 2s intervals
    const POLL_INTERVAL = 2000;
    const id = paymentId || sessionId;

    for (let attempt = 0; attempt < MAX_ADDRESS_POLLS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      try {
        const res = await fetch(
          `/api/payments/status?gateway=juicyway&session_id=${sessionId}&payment_id=${id}&check_address=true`,
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
  };

  const initializeCryptoPayment = async () => {
    if (!pendingCryptoOrder || !merchantId) return;

    setIsInitializingCrypto(true);
    try {
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          order_id: pendingCryptoOrder.orderId,
          amount: pendingCryptoOrder.amount,
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
          errorData.details ||
            errorData.error ||
            'Payment initialization failed',
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
              currency:
                address.currency || paymentResult.crypto_payment.currency,
              amount: cryptoAmount,
              confirmation_time:
                paymentResult.crypto_payment.confirmation_time,
              orderId: pendingCryptoOrder.orderId,
              reference: paymentResult.reference,
              sessionId,
              paymentId,
              qrcode: address.qrcode,
              trackingToken: pendingCryptoOrder.trackingToken,
            });
          } else {
            throw new Error(
              'Crypto wallet address generation timed out. Please try again.',
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
  };

  // Polling ref to track interval and attempts
  const pollingRef = useRef<{
    intervalId: NodeJS.Timeout | null;
    attempts: number;
  }>({
    intervalId: null,
    attempts: 0,
  });

  const verifyCryptoPayment = useCallback(async () => {
    const verificationId =
      cryptoPaymentData?.paymentId || cryptoPaymentData?.sessionId;

    if (!verificationId) {
      console.error('No payment ID or session ID available for verification');
      setCryptoVerificationStatus('failed');
      return;
    }

    setIsVerifyingCrypto(true);
    setCryptoVerificationStatus('checking');
    pollingRef.current.attempts = 0;

    const checkPaymentStatus = async (): Promise<
      'confirmed' | 'failed' | 'pending'
    > => {
      try {
        const response = await fetch(
          `/api/payments/status?gateway=juicyway&payment_id=${verificationId}`,
        );

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = {
              message: `HTTP ${response.status}: ${response.statusText}`,
            };
          }
          console.error('Payment status check failed:', {
            status: response.status,
            statusText: response.statusText,
            paymentId: verificationId,
            error: errorData,
          });
          return 'pending';
        }

        const result = await response.json();

        if (result.is_confirmed) return 'confirmed';
        if (result.is_failed) return 'failed';
        return 'pending';
      } catch (error) {
        console.error('Payment verification error:', error);
        return 'pending';
      }
    };

    const onConfirmed = () => {
      setIsVerifyingCrypto(false);
      setCryptoVerificationStatus('confirmed');
      clearCheckoutSession();
      clearCart();
      const tokenParam = cryptoPaymentData!.trackingToken
        ? `&trackingToken=${cryptoPaymentData!.trackingToken}`
        : '';
      routerPush(
        getHref(
          `/order-success?type=crypto&orderId=${cryptoPaymentData!.orderId}&reference=${cryptoPaymentData!.reference}${tokenParam}`,
        ),
      );
    };

    const onFailed = () => {
      setIsVerifyingCrypto(false);
      setCryptoVerificationStatus('failed');
    };

    const initialStatus = await checkPaymentStatus();

    if (initialStatus === 'confirmed') {
      onConfirmed();
      return;
    }
    if (initialStatus === 'failed') {
      onFailed();
      return;
    }

    // Start polling
    setCryptoVerificationStatus('pending');

    pollingRef.current.intervalId = setInterval(async () => {
      pollingRef.current.attempts++;
      const maxAttempts = 30;

      if (pollingRef.current.attempts >= maxAttempts) {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        setIsVerifyingCrypto(false);
        setCryptoVerificationStatus('pending');
        return;
      }

      const status = await checkPaymentStatus();

      if (status === 'confirmed') {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        onConfirmed();
      } else if (status === 'failed') {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        onFailed();
      }
    }, 10000);
  }, [cryptoPaymentData, clearCheckoutSession, clearCart, routerPush, getHref]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current.intervalId) {
        clearInterval(pollingRef.current.intervalId);
      }
    };
  }, []);

  return {
    cryptoPaymentData,
    setCryptoPaymentData,
    isVerifyingCrypto,
    setIsVerifyingCrypto,
    cryptoVerificationStatus,
    setCryptoVerificationStatus,
    showCryptoSelector,
    setShowCryptoSelector,
    selectedCryptoChain,
    setSelectedCryptoChain,
    selectedCryptoCurrency,
    pendingCryptoOrder,
    setPendingCryptoOrder,
    isInitializingCrypto,
    handleCryptoCurrencyChange,
    handleCryptoBack,
    initializeCryptoPayment,
    verifyCryptoPayment,
  };
}
