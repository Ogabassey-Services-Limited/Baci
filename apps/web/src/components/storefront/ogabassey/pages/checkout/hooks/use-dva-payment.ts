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

    setIsInitializingDva(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          order_id: order.id,
          amount: paymentAmount,
          currency: 'NGN',
          customer_email: customerEmail,
          customer_name: `${firstName} ${lastName}`.trim(),
          customer_phone: customerPhone,
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
          amount: paymentAmount,
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
