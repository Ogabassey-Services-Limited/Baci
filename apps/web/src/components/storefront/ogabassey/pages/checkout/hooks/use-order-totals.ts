'use client';

import { useEffect, useState } from 'react';
import { calculateCommerce } from '@/lib/supabase/client';

interface OrderTotals {
  total: number;
  taxAmount: number;
}

interface UseOrderTotalsOptions {
  cartTotal: number;
  deliveryCost: number;
  taxRate: number;
}

export function useOrderTotals({ cartTotal, deliveryCost, taxRate }: UseOrderTotalsOptions) {
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const result = await calculateCommerce('calculate_order', {
          subtotal: cartTotal,
          shippingFee: deliveryCost,
          taxRate,
        });
        setOrderTotals(result);
      } catch (err) {
        console.error('Failed to fetch totals from brain', err);
      }
    };
    fetchTotals();
  }, [cartTotal, deliveryCost, taxRate]);

  return orderTotals;
}
