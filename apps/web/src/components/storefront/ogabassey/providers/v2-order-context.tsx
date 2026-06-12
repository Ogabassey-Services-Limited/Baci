'use client';

import type React from 'react';
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Order } from '../types';

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const ORDERS_STORAGE_KEY = 'ogabassey_v2_orders';
const EMPTY_ORDERS: Order[] = [];

// localStorage-backed external store. The parsed snapshot is cached against
// the raw string so getOrdersSnapshot stays referentially stable between
// renders (a useSyncExternalStore requirement).
let ordersSnapshotRaw: string | null = null;
let ordersSnapshot: Order[] = EMPTY_ORDERS;
const ordersListeners = new Set<() => void>();

function subscribeToOrders(listener: () => void): () => void {
  ordersListeners.add(listener);
  return () => {
    ordersListeners.delete(listener);
  };
}

function getOrdersSnapshot(): Order[] {
  const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (raw === ordersSnapshotRaw) {
    return ordersSnapshot;
  }
  ordersSnapshotRaw = raw;
  if (raw) {
    try {
      ordersSnapshot = JSON.parse(raw) as Order[];
    } catch (e) {
      console.error('Failed to parse saved orders', e);
      ordersSnapshot = EMPTY_ORDERS;
    }
  } else {
    ordersSnapshot = EMPTY_ORDERS;
  }
  return ordersSnapshot;
}

function getServerOrdersSnapshot(): Order[] {
  return EMPTY_ORDERS;
}

function persistOrders(nextOrders: Order[]): void {
  ordersSnapshot = nextOrders;
  ordersSnapshotRaw = JSON.stringify(nextOrders);
  localStorage.setItem(ORDERS_STORAGE_KEY, ordersSnapshotRaw);
  for (const listener of ordersListeners) {
    listener();
  }
}

export const V2OrderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const orders = useSyncExternalStore(
    subscribeToOrders,
    getOrdersSnapshot,
    getServerOrdersSnapshot
  );

  const addOrder = (order: Order) => {
    persistOrders([order, ...getOrdersSnapshot()]);
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
