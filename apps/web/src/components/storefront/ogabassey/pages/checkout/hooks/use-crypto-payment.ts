'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CryptoChain,
  CryptoCurrency,
  CryptoPaymentData,
  CryptoVerificationStatus,
  PendingCryptoOrder,
} from '../types';
import { CRYPTO_CHAIN_SUPPORT } from '../utils';
import { runCryptoPaymentInitialization } from './initialize-crypto-payment';

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

  // The initialization flow lives in a module-scope helper because its
  // try/finally + throw-inside-try/catch statements are React Compiler
  // bailouts when defined inside the hook body.
  const initializeCryptoPayment = async () => {
    if (!pendingCryptoOrder || !merchantId) return;

    await runCryptoPaymentInitialization({
      merchantId,
      pendingCryptoOrder,
      selectedCryptoChain,
      selectedCryptoCurrency,
      setShowCryptoSelector,
      setCryptoPaymentData,
      setIsInitializingCrypto,
    });
  };

  // Polling ref to track interval and attempts
  const pollingRef = useRef<{
    intervalId: NodeJS.Timeout | null;
    attempts: number;
  }>({
    intervalId: null,
    attempts: 0,
  });

  const verifyCryptoPayment = async () => {
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
  };

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
