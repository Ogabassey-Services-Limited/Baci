import { Pressable, Text, View } from 'react-native';
import { styles } from '@/components/storefront/ProductGrid.styles';
import { palette } from '@/constants/Colors';

interface HomeFeedEmptyStateProps {
  shouldShowFatalError: boolean;
  shouldShowInitialLoading: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  /** Loading skeleton element, injected to avoid a hard dependency in tests. */
  skeleton: React.ReactNode;
}

/**
 * Picks the right empty render for the virtualized home feed when `data` is
 * empty: skeleton while loading, error+retry on a fatal error, the filter-empty
 * "no match" note otherwise — but stays null while fetching so a filter change
 * doesn't flash "No products match" (parity with `ProductGridView`).
 */
export function HomeFeedEmptyState({
  shouldShowFatalError,
  shouldShowInitialLoading,
  isLoading,
  isFetching,
  isRetrying,
  onRetry,
  skeleton,
}: HomeFeedEmptyStateProps) {
  if (shouldShowFatalError) {
    return (
      <View style={styles.emptyState} testID="home-feed-error">
        <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
          Failed to load products. Please try again.
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel={
            isRetrying ? 'Retrying to load products' : 'Retry loading products'
          }
        >
          <Text style={styles.retryButtonText}>
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || shouldShowInitialLoading) {
    return <>{skeleton}</>;
  }

  if (!isFetching) {
    return (
      <View style={styles.emptyState} testID="home-feed-empty">
        <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
          No products match your criteria.
        </Text>
      </View>
    );
  }

  return null;
}
