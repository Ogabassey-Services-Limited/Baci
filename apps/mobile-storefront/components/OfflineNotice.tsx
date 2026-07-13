import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { offlineNoticeStyles as styles } from './OfflineNotice.styles';

interface OfflineNoticeProps {
  /** Type of notice to display */
  variant?: 'banner' | 'card' | 'inline';
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Callback when retry button is pressed */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Custom message to display */
  message?: string;
  /** Whether to show cached data notice */
  showCachedDataNotice?: boolean;
}

/**
 * Component to display offline status with retry capability
 *
 * @example
 * ```tsx
 * <OfflineNotice
 *   variant="card"
 *   showRetry
 *   onRetry={refetch}
 *   isRetrying={isRefetching}
 *   showCachedDataNotice
 * />
 * ```
 */
export function OfflineNotice({
  variant = 'card',
  showRetry = true,
  onRetry,
  isRetrying = false,
  message,
  showCachedDataNotice = false,
}: OfflineNoticeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const defaultMessage = showCachedDataNotice
    ? "You're offline. Showing cached data."
    : "You're offline. Please check your connection.";

  const displayMessage = message || defaultMessage;

  if (variant === 'banner') {
    return (
      <View
        style={[styles.banner, { backgroundColor: colors.warning }]}
        accessibilityRole="alert"
        accessibilityLabel={displayMessage}
      >
        <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
        <Text style={styles.bannerText}>{displayMessage}</Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            disabled={isRetrying}
            style={styles.bannerRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry connection"
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#92400E" />
            ) : (
              <Ionicons name="refresh-outline" size={18} color="#92400E" />
            )}
          </Pressable>
        )}
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <View
        style={styles.inline}
        accessibilityRole="alert"
        accessibilityLabel={displayMessage}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={14}
          color={colors.textSecondary}
        />
        <Text style={[styles.inlineText, { color: colors.textSecondary }]}>
          {displayMessage}
        </Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            disabled={isRetrying}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={BRAND.primary} />
            ) : (
              <Text style={[styles.inlineRetry, { color: BRAND.primary }]}>
                Retry
              </Text>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  // Card variant (default)
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card }]}
      accessibilityRole="alert"
      accessibilityLabel={displayMessage}
    >
      <View style={styles.cardIconContainer}>
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={colors.textSecondary}
        />
      </View>

      <Text style={[styles.cardTitle, { color: colors.text }]}>
        No Internet Connection
      </Text>

      <Text style={[styles.cardMessage, { color: colors.textSecondary }]}>
        {displayMessage}
      </Text>

      {showCachedDataNotice && (
        <View
          style={[
            styles.cachedNotice,
            { backgroundColor: `${BRAND.primary}10` },
          ]}
        >
          <Ionicons name="time-outline" size={14} color={BRAND.primary} />
          <Text style={[styles.cachedText, { color: BRAND.primary }]}>
            Showing data from your last visit
          </Text>
        </View>
      )}

      {showRetry && onRetry && (
        <Pressable
          style={[
            styles.retryButton,
            { backgroundColor: BRAND.primary },
            isRetrying && styles.retryButtonDisabled,
          ]}
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          {isRetrying ? (
            <>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.retryButtonText}>Retrying…</Text>
            </>
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color="#FFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

/**
 * Empty state component for when there's no data and user is offline
 */
interface OfflineEmptyStateProps {
  /** Title to display */
  title?: string;
  /** Description message */
  description?: string;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Callback when retry button is pressed */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
}

export function OfflineEmptyState({
  title = "Can't load content",
  description = 'Connect to the internet to see this content.',
  showRetry = true,
  onRetry,
  isRetrying = false,
}: OfflineEmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[styles.emptyState, { backgroundColor: colors.background }]}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${description}`}
    >
      <View
        style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}
      >
        <Ionicons name="wifi-outline" size={40} color={colors.textSecondary} />
        <View style={styles.emptyIconBadge}>
          <Ionicons name="close" size={14} color="#FFF" />
        </View>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>

      <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
        {description}
      </Text>

      {showRetry && onRetry && (
        <Pressable
          style={[
            styles.emptyRetryButton,
            { borderColor: BRAND.primary },
            isRetrying && styles.retryButtonDisabled,
          ]}
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Retry loading content"
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color={BRAND.primary} />
          ) : (
            <>
              <Ionicons
                name="refresh-outline"
                size={18}
                color={BRAND.primary}
              />
              <Text style={[styles.emptyRetryText, { color: BRAND.primary }]}>
                Retry
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
