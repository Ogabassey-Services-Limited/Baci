import React, { createContext, useContext, useState } from 'react';

export interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  type: 'order' | 'promo' | 'system';
  read: boolean;
  date: string; // Added date for grouping on the full page
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  removeNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([
      { id: 1, title: 'Order Shipped', message: 'Your order #OG-2491 has been shipped.', time: '2 mins ago', type: 'order', read: false, date: 'Today' },
      { id: 2, title: 'Flash Sale', message: 'Weekend deal: 15% off Accessories!', time: '1 hour ago', type: 'promo', read: false, date: 'Today' },
      { id: 3, title: 'Login Alert', message: 'New sign-in from iPhone 13.', time: '5 hours ago', type: 'system', read: false, date: 'Today' },
      { id: 4, title: 'Price Drop', message: 'The item "MacBook Air M2" in your wishlist is now on sale.', time: 'Yesterday', type: 'promo', read: true, date: 'Yesterday' },
      { id: 5, title: 'Order Delivered', message: 'Order #OG-1182 was delivered successfully.', time: '2 days ago', type: 'order', read: true, date: 'Last Week' },
      { id: 6, title: 'Welcome to Ogabassey', message: 'Thanks for creating an account. Start shopping now!', time: '1 week ago', type: 'system', read: true, date: 'Last Week' },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      removeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};