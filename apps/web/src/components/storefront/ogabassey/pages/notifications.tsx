'use client';

import {
  Bell,
  Check,
  CheckCircle2,
  Gift,
  Package,
  Shield,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

type NotificationType = 'order' | 'promo' | 'system';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  date: string;
  type: NotificationType;
  read: boolean;
}

// Mock notifications data
const initialNotifications: Notification[] = [
  {
    id: '1',
    title: 'Order Shipped',
    message: 'Your order #ORD-2024-001 has been shipped and is on its way.',
    time: '2 hours ago',
    date: 'Today',
    type: 'order',
    read: false,
  },
  {
    id: '2',
    title: 'Flash Sale Alert!',
    message: 'Get 30% off on all iPhones. Limited time offer!',
    time: '5 hours ago',
    date: 'Today',
    type: 'promo',
    read: false,
  },
  {
    id: '3',
    title: 'Security Update',
    message: 'We have updated our privacy policy. Please review the changes.',
    time: '1 day ago',
    date: 'Yesterday',
    type: 'system',
    read: true,
  },
  {
    id: '4',
    title: 'Order Delivered',
    message: 'Your order #ORD-2024-002 has been delivered successfully.',
    time: '2 days ago',
    date: 'Earlier',
    type: 'order',
    read: true,
  },
];

function getIcon(type: NotificationType): React.ReactElement {
  switch (type) {
    case 'order':
      return <Package size={18} />;
    case 'promo':
      return <Gift size={18} />;
    case 'system':
      return <Shield size={18} />;
    default:
      return <Bell size={18} />;
  }
}

function getColorClass(type: NotificationType): string {
  switch (type) {
    case 'order':
      return 'bg-blue-50 text-blue-600';
    case 'promo':
      return 'bg-red-50 text-red-600';
    case 'system':
      return 'bg-amber-50 text-amber-600';
    default:
      return 'bg-gray-50 text-gray-600';
  }
}

export const OgabasseyV2Notifications: React.FC = () => {
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'all' ? true : !n.read
  );

  // Group by date for visual separation
  const groupedNotifications = filteredNotifications.reduce(
    (acc, notification) => {
      const date = notification.date || 'Earlier';
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(notification);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="text-red-600 fill-red-600" />
            Notifications
          </h1>

          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg border border-gray-200 flex">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === 'unread' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Unread
              </button>
            </div>

            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-bold text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors px-3 py-2 hover:bg-white rounded-lg"
              >
                <CheckCircle2 size={14} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-16">
              <div className="size-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                All caught up!
              </h3>
              <p className="text-gray-500 text-sm">
                {filter === 'unread'
                  ? 'You have no unread notifications.'
                  : 'You have no notifications at the moment.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl">
            {Object.entries(groupedNotifications).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                  {date}
                </h3>
                <div className="space-y-3">
                  {items.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative p-4 rounded-xl border transition-all duration-200 group ${notification.read ? 'bg-white border-gray-100' : 'bg-white border-red-100 shadow-sm'}`}
                    >
                      {!notification.read && (
                        <div className="absolute top-4 right-4 size-2 bg-red-600 rounded-full" />
                      )}

                      <div className="flex gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getColorClass(notification.type)}`}
                        >
                          {getIcon(notification.type)}
                        </div>

                        <div className="flex-1 pr-8">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <h4
                              className={`text-sm font-bold ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}
                            >
                              {notification.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {notification.time}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 leading-relaxed">
                            {notification.message}
                          </p>
                        </div>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                            title="Mark as read"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeNotification(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
