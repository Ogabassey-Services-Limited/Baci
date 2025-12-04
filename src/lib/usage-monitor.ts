/**
 * Supabase Realtime Usage Monitor
 *
 * Monitors usage of Supabase Realtime features to warn administrators
 * when approaching free tier limits.
 *
 * Free Tier Limits (as of 2025):
 * - 200 concurrent connections
 * - 2 million messages/month
 * - 100 messages/second
 */

import {
  type RealtimeUsageStats,
  USAGE_THRESHOLDS,
} from '@/types/notifications';

/**
 * Get current usage statistics from Supabase
 * Note: This requires the Supabase Management API which needs additional setup
 *
 * For now, this returns simulated data - in production you would:
 * 1. Set up a Supabase Management API key
 * 2. Call the usage endpoints to get actual metrics
 * 3. Or use Supabase's built-in usage alerts
 */
// biome-ignore lint/suspicious/useAwait: Future async implementation
export async function getRealtimeUsageStats(): Promise<RealtimeUsageStats> {
  // In production, you would fetch from Supabase Management API:
  // GET https://api.supabase.com/v1/projects/{project_ref}/usage
  // with your management API key

  // For demonstration, we return estimated values
  // These would be populated from actual API calls in production
  const mockStats: RealtimeUsageStats = {
    concurrent_connections: 0, // Would come from API
    max_connections: USAGE_THRESHOLDS.FREE_TIER_MAX_CONNECTIONS,
    messages_this_month: 0, // Would come from API
    max_messages: USAGE_THRESHOLDS.FREE_TIER_MAX_MESSAGES,
    connection_usage_percent: 0,
    message_usage_percent: 0,
    is_approaching_limit: false,
    is_over_limit: false,
  };

  // Calculate percentages
  mockStats.connection_usage_percent = Math.round(
    (mockStats.concurrent_connections / mockStats.max_connections) * 100
  );
  mockStats.message_usage_percent = Math.round(
    (mockStats.messages_this_month / mockStats.max_messages) * 100
  );

  // Determine if approaching limits
  mockStats.is_approaching_limit =
    mockStats.connection_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT ||
    mockStats.message_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT;

  mockStats.is_over_limit =
    mockStats.connection_usage_percent >= 100 ||
    mockStats.message_usage_percent >= 100;

  return mockStats;
}

/**
 * Check if usage is approaching warning threshold
 */
export function isApproachingLimit(stats: RealtimeUsageStats): boolean {
  return (
    stats.connection_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT ||
    stats.message_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT
  );
}

/**
 * Check if usage is at critical threshold
 */
export function isCriticalUsage(stats: RealtimeUsageStats): boolean {
  return (
    stats.connection_usage_percent >= USAGE_THRESHOLDS.CRITICAL_PERCENT ||
    stats.message_usage_percent >= USAGE_THRESHOLDS.CRITICAL_PERCENT
  );
}

/**
 * Get warning message based on current usage
 */
export function getUsageWarningMessage(
  stats: RealtimeUsageStats
): string | null {
  const warnings: string[] = [];

  if (stats.connection_usage_percent >= USAGE_THRESHOLDS.CRITICAL_PERCENT) {
    warnings.push(
      `CRITICAL: Concurrent connections at ${stats.connection_usage_percent}% of limit`
    );
  } else if (
    stats.connection_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT
  ) {
    warnings.push(
      `Warning: Concurrent connections at ${stats.connection_usage_percent}% of limit`
    );
  }

  if (stats.message_usage_percent >= USAGE_THRESHOLDS.CRITICAL_PERCENT) {
    warnings.push(
      `CRITICAL: Monthly messages at ${stats.message_usage_percent}% of limit`
    );
  } else if (stats.message_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT) {
    warnings.push(
      `Warning: Monthly messages at ${stats.message_usage_percent}% of limit`
    );
  }

  return warnings.length > 0 ? warnings.join('. ') : null;
}

/**
 * Format usage stats for display
 */
export function formatUsageForDisplay(stats: RealtimeUsageStats): {
  connections: string;
  messages: string;
  status: 'ok' | 'warning' | 'critical';
} {
  let status: 'ok' | 'warning' | 'critical' = 'ok';

  if (isCriticalUsage(stats)) {
    status = 'critical';
  } else if (isApproachingLimit(stats)) {
    status = 'warning';
  }

  return {
    connections: `${stats.concurrent_connections.toLocaleString()} / ${stats.max_connections.toLocaleString()}`,
    messages: `${stats.messages_this_month.toLocaleString()} / ${stats.max_messages.toLocaleString()}`,
    status,
  };
}

/**
 * Estimate monthly message usage based on current rate
 *
 * @param currentMessages - Messages used so far this month
 * @param dayOfMonth - Current day of the month
 * @returns Estimated total messages for the month
 */
export function estimateMonthlyUsage(
  currentMessages: number,
  dayOfMonth: number
): number {
  if (dayOfMonth <= 0) return currentMessages;

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();

  const dailyRate = currentMessages / dayOfMonth;
  return Math.round(dailyRate * daysInMonth);
}

/**
 * Create a usage warning notification payload
 * This can be used to auto-create system notifications for admins
 */
export function createUsageWarningNotification(stats: RealtimeUsageStats): {
  title: string;
  message: string;
  notification_type: 'warning' | 'error';
  priority: 'high' | 'urgent';
} | null {
  if (!isApproachingLimit(stats)) {
    return null;
  }

  const isCritical = isCriticalUsage(stats);
  const warnings: string[] = [];

  if (stats.connection_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT) {
    warnings.push(
      `concurrent connections at ${stats.connection_usage_percent}%`
    );
  }

  if (stats.message_usage_percent >= USAGE_THRESHOLDS.WARNING_PERCENT) {
    warnings.push(`monthly messages at ${stats.message_usage_percent}%`);
  }

  return {
    title: isCritical
      ? 'URGENT: Supabase Usage Critical'
      : 'Supabase Usage Warning',
    message: `Your platform is approaching Supabase free tier limits: ${warnings.join(
      ', '
    )}. Consider upgrading to avoid service interruption.`,
    notification_type: isCritical ? 'error' : 'warning',
    priority: isCritical ? 'urgent' : 'high',
  };
}
