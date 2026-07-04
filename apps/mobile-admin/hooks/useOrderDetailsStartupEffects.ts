import { useEffect, useRef } from 'react';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { getDispatchPhoneFromOrder } from '@/lib/order-shipment';
import { asyncStorage as AsyncStorage } from '@/lib/storage';
import { parseSavedRiders } from '@/lib/validators/storage';

export function useOrderDetailsStartupEffects({
  actionParam,
  order,
  setPaymentAmount,
  setRiderPhone,
  setSavedRiders,
  setShowCreditModal,
  setShowRecordPaymentModal,
}: {
  actionParam?: 'record-payment' | 'ship-on-credit';
  order?: OrderDetailsRecord | null;
  setPaymentAmount: (value: string) => void;
  setRiderPhone: (value: string) => void;
  setSavedRiders: (value: string[]) => void;
  setShowCreditModal: (value: boolean) => void;
  setShowRecordPaymentModal: (value: boolean) => void;
}) {
  const riderPhoneInitializedOrderIdRef = useRef<string | null>(null);
  const orderAmountPaid = order?.amount_paid;
  const orderBalance = order?.balance;
  const orderDispatchPhone = order ? getDispatchPhoneFromOrder(order) : '';
  const orderId = order?.id;
  const orderTotal = order?.total;

  useEffect(() => {
    if (!orderId || !actionParam) return;

    if (actionParam === 'record-payment') {
      setShowRecordPaymentModal(true);
      const balance =
        orderBalance ?? Number(orderTotal) - Number(orderAmountPaid || 0);
      if (balance > 0) {
        setPaymentAmount(String(Math.round(balance)));
      }
    } else if (actionParam === 'ship-on-credit') {
      setShowCreditModal(true);
    }
  }, [
    actionParam,
    orderAmountPaid,
    orderBalance,
    orderId,
    orderTotal,
    setPaymentAmount,
    setShowCreditModal,
    setShowRecordPaymentModal,
  ]);

  useEffect(() => {
    if (!orderId) {
      riderPhoneInitializedOrderIdRef.current = null;
      return;
    }
    if (riderPhoneInitializedOrderIdRef.current === orderId) {
      return;
    }

    riderPhoneInitializedOrderIdRef.current = orderId;
    setRiderPhone(orderDispatchPhone);
  }, [orderDispatchPhone, orderId, setRiderPhone]);

  useEffect(() => {
    async function loadSavedRiders() {
      try {
        const saved = await AsyncStorage.getItem('saved_riders');
        setSavedRiders(parseSavedRiders(saved));
      } catch (error) {
        console.error('Failed to load saved riders', error);
        setSavedRiders([]);
      }
    }

    void loadSavedRiders();
  }, [setSavedRiders]);
}
