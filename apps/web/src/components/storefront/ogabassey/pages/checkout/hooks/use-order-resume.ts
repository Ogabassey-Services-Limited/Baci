'use client';

import { useEffect, useState } from 'react';
import type { PaymentMethod, ResumedOrder } from '../types';

interface SetCheckoutFieldsFn {
  (values: {
    firstName: string;
    lastName: string;
    customerEmail: string;
    customerPhone: string;
    newAddressStreet: string;
    newAddressState: string;
    newAddressCity: string;
    currentStep: 'contact' | 'delivery' | 'payment';
    completedSteps: { contact: boolean; delivery: boolean };
  }): void;
}

interface UseOrderResumeOptions {
  resumeOrderId: string | null;
  preferredGateway: 'credpal' | 'credit_direct' | null;
  setCheckoutFields: SetCheckoutFieldsFn;
  setPaymentTab: (tab: 'full' | 'installments') => void;
  setPaymentMethod: (method: PaymentMethod) => void;
}

export function useOrderResume({
  resumeOrderId,
  preferredGateway,
  setCheckoutFields,
  setPaymentTab,
  setPaymentMethod,
}: UseOrderResumeOptions) {
  const [resumedOrder, setResumedOrder] = useState<ResumedOrder | null>(null);
  const [isLoadingResumedOrder, setIsLoadingResumedOrder] = useState(!!resumeOrderId);
  const [resumeOrderError, setResumeOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeOrderId) return;

    const fetchResumedOrder = async () => {
      setIsLoadingResumedOrder(true);
      try {
        const res = await fetch(`/api/storefront/orders/${resumeOrderId}`);
        if (res.ok) {
          const orderData = await res.json();
          setResumedOrder({
            id: orderData.id,
            short_id: orderData.short_id,
            subtotal: orderData.subtotal,
            shipping_cost: orderData.shipping_cost || 0,
            total: orderData.total,
            customer_name: orderData.customer_name,
            customer_email: orderData.customer_email,
            customer_phone: orderData.customer_phone,
            shipping_address: orderData.shipping_address || {
              address: '',
              city: '',
              state: '',
              phone: '',
            },
            items: orderData.items || [],
          });

          const [first, ...rest] = (orderData.customer_name || '').split(' ');
          setCheckoutFields({
            firstName: first || '',
            lastName: rest.join(' ') || '',
            customerEmail: orderData.customer_email || '',
            customerPhone: orderData.customer_phone || '',
            newAddressStreet: orderData.shipping_address?.address || '',
            newAddressState: orderData.shipping_address?.state || '',
            newAddressCity: orderData.shipping_address?.city || '',
            currentStep: 'payment',
            completedSteps: { contact: true, delivery: true },
          });

          if (preferredGateway === 'credit_direct' || preferredGateway === 'credpal') {
            setPaymentTab('installments');
            setPaymentMethod(preferredGateway);
          } else if (preferredGateway) {
            setPaymentTab('full');
            setPaymentMethod(preferredGateway);
          }
        } else {
          console.error('Failed to fetch resumed order');
          setResumeOrderError('Order not found. It may have been completed or expired.');
        }
      } catch (error) {
        console.error('Error fetching resumed order:', error);
        setResumeOrderError('Failed to load order details. Please try again.');
      } finally {
        setIsLoadingResumedOrder(false);
      }
    };
    fetchResumedOrder();
  }, [resumeOrderId, setCheckoutFields, preferredGateway]);

  return { resumedOrder, isLoadingResumedOrder, resumeOrderError };
}
