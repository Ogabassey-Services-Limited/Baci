import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { parseSavedRiders } from '@/lib/validators/storage';

export function useOrderDetailsStartupEffects({
  actionParam,
  order,
  setPaymentAmount,
  setSavedRiders,
  setShowCreditModal,
  setShowRecordPaymentModal,
}: {
  actionParam?: 'record-payment' | 'ship-on-credit';
  order?: OrderDetailsRecord | null;
  setPaymentAmount: (value: string) => void;
  setSavedRiders: (value: string[]) => void;
  setShowCreditModal: (value: boolean) => void;
  setShowRecordPaymentModal: (value: boolean) => void;
}) {
  // Use stable primitives rather than the whole `order` object to avoid
  // re-opening modals on every refetch that returns a new object reference.
  const _orderId = order?.id;
  const _orderPaymentStatus = order?.payment_status;

  useEffect(() => {
    if (!order || !actionParam) return;

    if (actionParam === 'record-payment') {
      setShowRecordPaymentModal(true);
      const balance =
        order.balance ?? Number(order.total) - Number(order.amount_paid || 0);
      if (balance > 0) {
        setPaymentAmount(String(Math.round(balance)));
      }
    } else if (actionParam === 'ship-on-credit') {
      setShowCreditModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actionParam,
    setPaymentAmount,
    setShowCreditModal,
    setShowRecordPaymentModal,
    order.amount_paid,
    order.total,
    order.balance,
    order,
  ]);

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
