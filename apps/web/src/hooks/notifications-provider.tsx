'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { useMerchant, useMerchantSafe } from './use-merchant-client';
import {
  type UseNotificationsReturn,
  useNotificationsState,
} from './use-notifications-state';

const NotificationsContext = createContext<UseNotificationsReturn | null>(null);

/** One Realtime owner for every dashboard notification surface. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { merchant } = useMerchant();
  const value = useNotificationsState(merchant);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): UseNotificationsReturn {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within NotificationsProvider'
    );
  }
  return context;
}

export function useNotificationsSafe(): UseNotificationsReturn | null {
  const merchantContext = useMerchantSafe();
  const context = useContext(NotificationsContext);
  if (!merchantContext) {
    return null;
  }
  if (!context) {
    throw new Error(
      'useNotificationsSafe must be used within NotificationsProvider'
    );
  }
  return context;
}
