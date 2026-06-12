'use client';

import { useState } from 'react';
import type { DvaData } from '../types';
import { toast } from '@/hooks/use-toast';

interface UseDvaPaymentOptions {
  merchantId: string | undefined;
  customerEmail: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
}

interface BankTransferRequest {
  merchantId: string;
  orderId: string;
  paymentAmount: number;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
}

interface BankTransferEffects {
  isOrderInFlightRef: React.MutableRefObject<boolean>;
  setIsProcessing: (v: boolean) => void;
  setIsInitializingDva: (v: boolean) => void;
  setDvaData: (data: DvaData | null) => void;
  setDvaCountdown: (seconds: number) => void;
}

// Module-scope helper: try/catch/finally and throw-in-try are not yet
// supported by React Compiler inside component/hook bodies.
async function runBankTransferInitialization(
  request: BankTransferRequest,
  effects: BankTransferEffects,
): Promise<void> {
  const {
    isOrderInFlightRef,
    setIsProcessing,
    setIsInitializingDva,
    setDvaData,
    setDvaCountdown,
  } = effects;

  setIsInitializingDva(true);
  try {
    const response = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: request.merchantId,
        order_id: request.orderId,
        currency: 'NGN',
        customer_email: request.customerEmail,
        customer_name: request.customerName,
        customer_phone: request.customerPhone,
        gateway: 'paystack',
        payment_type: 'dva',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 'Failed to initialize bank transfer',
      );
    }

    const result = await response.json();
    if (result.success && result.dva) {
      setDvaData({
        ...result.dva,
        amount: request.paymentAmount,
        reference: result.reference,
      });
      setDvaCountdown(3600);
      isOrderInFlightRef.current = false;
    } else {
      throw new Error('DVA not returned by the gateway');
    }
  } catch (error) {
    console.error('DVA initialization error:', error);
    toast({
      title: 'Bank Transfer Failed',
      description:
        error instanceof Error
          ? error.message
          : 'Failed to initialize bank transfer',
      variant: 'destructive',
    });
    isOrderInFlightRef.current = false;
  } finally {
    setIsProcessing(false);
    setIsInitializingDva(false);
  }
}

export function useDvaPayment({
  merchantId,
  customerEmail,
  customerPhone,
  firstName,
  lastName,
}: UseDvaPaymentOptions) {
  const [dvaData, setDvaData] = useState<DvaData | null>(null);
  const [isInitializingDva, setIsInitializingDva] = useState(false);
  const [dvaCountdown, setDvaCountdown] = useState(3600);

  const handleBankTransfer = async (
    order: { id: string },
    paymentAmount: number,
    isOrderInFlightRef: React.MutableRefObject<boolean>,
    setIsProcessing: (v: boolean) => void,
  ) => {
    if (!merchantId) {
      isOrderInFlightRef.current = false;
      return;
    }

    await runBankTransferInitialization(
      {
        merchantId,
        orderId: order.id,
        paymentAmount,
        customerEmail,
        customerPhone,
        customerName: `${firstName} ${lastName}`.trim(),
      },
      {
        isOrderInFlightRef,
        setIsProcessing,
        setIsInitializingDva,
        setDvaData,
        setDvaCountdown,
      },
    );
  };

  return {
    dvaData,
    setDvaData,
    isInitializingDva,
    dvaCountdown,
    setDvaCountdown,
    handleBankTransfer,
  };
}
