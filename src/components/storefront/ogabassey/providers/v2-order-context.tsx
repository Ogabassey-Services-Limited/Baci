'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Order } from '../types';

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const V2OrderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('ogabassey_v2_orders');
    if (saved) {
      try {
        setOrders(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved orders', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ogabassey_v2_orders', JSON.stringify(orders));
  }, [orders]);

  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
  };

  const getOrder = (id: string) => {
    return orders.find((o) => o.id === id);
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, getOrder }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useV2Order = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useV2Order must be used within a V2OrderProvider');
  }
  return context;
};
