import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { OfflineEmptyState } from '@/components/OfflineNotice';
import type Colors from '@/constants/Colors';

type ProductDetailRouteStateColors = (typeof Colors)['light'];

type ProductDetailRouteStateProps = {
  colors: ProductDetailRouteStateColors;
  error?: unknown;
  onGoBack?: () => void;
  onRetry?: () => void;
  state: 'error' | 'invalid' | 'loading' | 'offline';
};

export function ProductDetailRouteState({
  colors,
  error,
  onGoBack,
  onRetry,
  state,
}: ProductDetailRouteStateProps) {
  if (state === 'loading') {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading product…
        </Text>
      </View>
    );
  }

  if (state === 'offline') {
    return (
      <View
        style={[styles.errorContainer, { backgroundColor: colors.background }]}
      >
        <OfflineEmptyState
          title="Product Unavailable Offline"
          description="Connect to the internet to view this product. It will auto-retry when your connection is restored."
          onRetry={onRetry}
        />
      </View>
    );
  }

  const isInvalid = state === 'invalid';

  return (
    <View
      style={[styles.errorContainer, { backgroundColor: colors.background }]}
    >
      <Ionicons
        name="alert-circle-outline"
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        {isInvalid ? 'Invalid Product Link' : 'Product not found'}
      </Text>
      <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
        {isInvalid
          ? 'This product link is not valid. Please try searching for the product.'
          : getProductRouteErrorMessage(error)}
      </Text>
      {onGoBack ? (
        <Pressable
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onGoBack}
          accessibilityLabel="Go back to previous screen"
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.retryButtonText,
              { color: colors.primaryForeground },
            ]}
          >
            Go Back
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getProductRouteErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'This product may no longer be available';
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 40,
  },
  errorSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  retryButton: {
    borderRadius: 24,
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontWeight: '600',
  },
});
