/**
 * Notification System Types
 *
 * Type definitions for the admin notification system that enables
 * platform admins to send notifications to merchants via in-app
 * notification center and site banners.
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TargetType = 'all' | 'specific' | 'segment';
export type NotificationChannel = 'in_app' | 'banner';
export type TargetSegment = 'new' | 'active' | 'at_risk';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'info',
  'success',
  'warning',
  'error',
];
export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];
export const TARGET_TYPES: TargetType[] = ['all', 'specific', 'segment'];
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'in_app',
  'banner',
];
export const TARGET_SEGMENTS: TargetSegment[] = ['new', 'active', 'at_risk'];

// Priority labels for display
export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

// Type labels for display
export const TYPE_LABELS: Record<NotificationType, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

// ============================================================================
// DATABASE MODELS
// ============================================================================

/**
 * Notification template for reusable messages.
 *
 * @future This interface is defined for the planned notification templates feature.
 * Templates will allow admins to create reusable notification messages.
 * Currently not in use - will be implemented in admin notifications templates page.
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  message_template: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  created_at: string;
  updated_at: string;
}

/**
 * Main notification entity created by admins
 */
export interface Notification {
  id: string;
  template_id: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  target_type: TargetType;
  target_merchant_ids: string[];
  target_segment: TargetSegment | null;
  channels: NotificationChannel[];
  action_url: string | null;
  action_label: string | null;
  scheduled_for: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  is_system: boolean;
}

/**
 * Per-merchant notification delivery record
 */
export interface MerchantNotification {
  id: string;
  notification_id: string;
  merchant_id: string;
  read_at: string | null;
  dismissed_at: string | null;
  banner_dismissed_at: string | null;
  created_at: string;
}

/**
 * Merchant notification with joined notification data
 */
export interface MerchantNotificationWithDetails extends MerchantNotification {
  notification: Notification;
}

/**
 * Merchant notification preferences
 */
export interface NotificationPreferences {
  merchant_id: string;
  in_app_enabled: boolean;
  banner_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: string;
}

// ============================================================================
// API INPUT TYPES
// ============================================================================

/**
 * Input for creating a new notification
 */
export interface CreateNotificationInput {
  title: string;
  message: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  target_type: TargetType;
  target_merchant_ids?: string[];
  target_segment?: TargetSegment;
  channels: NotificationChannel[];
  action_url?: string;
  action_label?: string;
  scheduled_for?: string;
  expires_at?: string;
  template_id?: string;
}

/**
 * Input for updating a notification (only before sent)
 */
export interface UpdateNotificationInput {
  title?: string;
  message?: string;
  notification_type?: NotificationType;
  priority?: NotificationPriority;
  target_type?: TargetType;
  target_merchant_ids?: string[];
  target_segment?: TargetSegment;
  channels?: NotificationChannel[];
  action_url?: string | null;
  action_label?: string | null;
  scheduled_for?: string | null;
  expires_at?: string | null;
}

/**
 * Input for updating notification preferences
 */
export interface UpdatePreferencesInput {
  in_app_enabled?: boolean;
  banner_enabled?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

/**
 * Input for marking notification as read/dismissed
 */
export interface UpdateMerchantNotificationInput {
  read?: boolean;
  dismissed?: boolean;
  banner_dismissed?: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Notification delivery statistics
 */
export interface NotificationStats {
  total_sent: number;
  total_read: number;
  total_dismissed: number;
  read_rate: number;
}

/**
 * Notification with delivery stats (for admin view)
 */
export interface NotificationWithStats extends Notification {
  stats: NotificationStats;
}

/**
 * Paginated response for notifications
 */
export interface PaginatedNotifications<T> {
  data: T[];
  cursor: string | null;
  has_more: boolean;
  total_count?: number;
}

/**
 * Active banner notification for display
 */
export interface ActiveBanner {
  id: string;
  notification_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
}

// ============================================================================
// REALTIME BROADCAST TYPES
// ============================================================================

/**
 * Payload sent via Supabase Broadcast when a new notification arrives
 */
export interface NotificationBroadcastPayload {
  event: 'new_notification';
  merchant_notification_id: string;
  notification: {
    id: string;
    title: string;
    message: string;
    notification_type: NotificationType;
    priority: NotificationPriority;
    channels: NotificationChannel[];
    action_url: string | null;
    action_label: string | null;
  };
  created_at: string;
}

/**
 * Payload sent via Supabase Broadcast when notification is updated
 */
export interface NotificationUpdateBroadcastPayload {
  event: 'notification_updated';
  merchant_notification_id: string;
  read_at?: string;
  dismissed_at?: string;
  banner_dismissed_at?: string;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/**
 * Props for the NotificationCenter component
 */
export interface NotificationCenterProps {
  className?: string;
}

/**
 * Props for the NotificationBanner component
 */
export interface NotificationBannerProps {
  className?: string;
}

/**
 * Props for individual notification item
 */
export interface NotificationItemProps {
  notification: MerchantNotificationWithDetails;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

/**
 * Filters for admin notification list
 */
export interface AdminNotificationFilters {
  status?: 'all' | 'sent' | 'scheduled' | 'draft';
  type?: NotificationType;
  priority?: NotificationPriority;
  date_from?: string;
  date_to?: string;
  search?: string;
}

/**
 * Filters for merchant notification list
 */
export interface MerchantNotificationFilters {
  unread_only?: boolean;
  type?: NotificationType;
}

// ============================================================================
// USAGE MONITORING TYPES
// ============================================================================

/**
 * Supabase Realtime usage statistics
 */
export interface RealtimeUsageStats {
  concurrent_connections: number;
  max_connections: number;
  messages_this_month: number;
  max_messages: number;
  connection_usage_percent: number;
  message_usage_percent: number;
  is_approaching_limit: boolean;
  is_over_limit: boolean;
}

/**
 * Usage warning thresholds
 */
export const USAGE_THRESHOLDS = {
  WARNING_PERCENT: 80,
  CRITICAL_PERCENT: 95,
  FREE_TIER_MAX_CONNECTIONS: 200,
  FREE_TIER_MAX_MESSAGES: 2_000_000,
} as const;
