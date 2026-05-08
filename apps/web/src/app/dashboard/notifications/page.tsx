'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle,
  ExternalLink,
  Info,
  // Loader2,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import type {
  MerchantNotificationWithDetails,
  NotificationType,
} from '@/types/notifications';

const typeStyles: Record<NotificationType, { bg: string; icon: typeof Info }> =
  {
    info: {
      bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      icon: Info,
    },
    success: {
      bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle,
    },
    warning: {
      bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: AlertCircle,
    },
  };

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    loadMore,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread' && n.read_at) return false;
    if (
      typeFilter !== 'all' &&
      n.notification?.notification_type !== typeFilter
    )
      return false;
    return true;
  });

  const handleMarkAsRead = async (
    notification: MerchantNotificationWithDetails
  ) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleDismiss = async (id: string) => {
    await dismiss(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Notifications 🔔
          </h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/notifications/preferences">
              <Settings className="h-4 w-4 mr-2" />
              Preferences
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Notifications</CardTitle>
            <div className="flex gap-2">
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as 'all' | 'unread')}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) =>
                  setTypeFilter(v as NotificationType | 'all')
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <BagLoader size={32} />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-1">No notifications</h3>
              <p className="text-muted-foreground">
                {filter === 'unread'
                  ? "You've read all your notifications"
                  : "You don't have any notifications yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => handleMarkAsRead(notification)}
                  onDismiss={() => handleDismiss(notification.id)}
                />
              ))}

              {hasMore && (
                <div className="pt-4 text-center">
                  <Button variant="outline" onClick={loadMore}>
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface NotificationCardProps {
  notification: MerchantNotificationWithDetails;
  onMarkAsRead: () => void;
  onDismiss: () => void;
}

function NotificationCard({
  notification,
  onMarkAsRead,
  onDismiss,
}: NotificationCardProps) {
  const isUnread = !notification.read_at;
  const type = notification.notification?.notification_type || 'info';
  const typeStyle = typeStyles[type];
  const Icon = typeStyle.icon;

  const handleClick = () => {
    onMarkAsRead();
    if (notification.notification?.action_url) {
      window.open(notification.notification.action_url, '_blank');
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'flex gap-4 p-4 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50 w-full text-left',
        isUnread && 'bg-muted/30 border-primary/20'
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Icon */}
      <div className={cn('shrink-0 p-2 rounded-full', typeStyle.bg)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4
                className={cn(
                  'font-medium truncate',
                  isUnread && 'font-semibold'
                )}
              >
                {notification.notification?.title}
              </h4>
              {isUnread && (
                <span className="shrink-0 h-2 w-2 bg-primary rounded-full" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {notification.notification?.message}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0', typeStyle.bg)}
          >
            {type}
          </Badge>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </span>

          <div className="flex items-center gap-2">
            {notification.notification?.action_url && (
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                {notification.notification.action_label || 'View'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </button>
  );
}
