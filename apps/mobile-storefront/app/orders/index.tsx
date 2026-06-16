import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import { Redirect, router, Stack } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import { OrdersListEmptyState } from '@/components/orders/OrdersListEmptyState';
import { OrdersListHeader } from '@/components/orders/OrdersListHeader';
import { OrdersListItem } from '@/components/orders/OrdersListItem';
import { ordersScreenStyles as styles } from '@/components/orders/orders-screen.styles';
import { useOrdersListController } from '@/components/orders/use-orders-list-controller';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import { useAuthStore } from '@/stores/auth-store';

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const handleGoBack = (): void => {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/account');
};

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);

  // 2026 Best Practice: Declarative auth-gate with intent-preserving returnTo
  const { redirectTo } = useRequireAuth();

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  const {
    error,
    fetchOrders,
    filteredOrders,
    handleRefresh,
    isLoading,
    isRefreshing,
    orderFilters,
    orders,
    searchQuery,
    selectedFilter,
    setSearchQuery,
    setSelectedFilter,
  } = useOrdersListController({
    customerId: customer?.id,
    onReconnect,
  });

  // Declarative auth-gate: redirect to login if not authenticated
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (!user) {
    return (
      <StorefrontScreenShell
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.emptyState}>
          <Ionicons
            name="person-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sign in to view orders
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            You need to be signed in to see your order history
          </Text>
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.shopButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </StorefrontScreenShell>
    );
  }

  if (isLoading) {
    return (
      <StorefrontScreenShell
        edges={['top', 'left', 'right']}
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </StorefrontScreenShell>
    );
  }

  // 2026 Best Practice: Different error states for offline vs online errors
  if (error) {
    // Show offline-specific empty state when offline
    if (!isOnline) {
      return (
        <StorefrontScreenShell
          edges={['top', 'left', 'right']}
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <OfflineEmptyState
            title="Orders Unavailable"
            description="Connect to the internet to view your order history"
            onRetry={fetchOrders}
            isRetrying={isRefreshing}
          />
        </StorefrontScreenShell>
      );
    }

    // Show generic error state when online
    return (
      <StorefrontScreenShell
        edges={['top', 'left', 'right']}
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity onPress={fetchOrders}>
          <Text style={[styles.retryText, { color: BRAND.primary }]}>
            Tap to retry
          </Text>
        </TouchableOpacity>
      </StorefrontScreenShell>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={[styles.backButton, { borderColor: colors.border }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backButtonText, { color: colors.text }]}>
              Account
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            My Orders
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {!isOnline && orders.length > 0 && (
          <OfflineNotice
            variant="banner"
            showCachedDataNotice
            showRetry
            onRetry={fetchOrders}
            isRetrying={isRefreshing}
          />
        )}

        <FlashList
          data={filteredOrders}
          renderItem={({ item }) => (
            <OrdersListItem
              item={item}
              colors={colors}
              formatDate={formatDate}
              onPress={(orderId) => router.push(`/orders/${orderId}`)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            orders.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <OrdersListEmptyState
              colors={colors}
              hasOrders={orders.length > 0}
              onClearSearch={() => setSearchQuery('')}
              onStartShopping={() => router.push('/')}
            />
          }
          ListHeaderComponent={
            orders.length > 0 ? (
              <OrdersListHeader
                colors={colors}
                orderFilters={orderFilters}
                selectedFilter={selectedFilter}
                onSelectFilter={setSelectedFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                filteredOrdersCount={filteredOrders.length}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </StorefrontScreenShell>
    </>
  );
}
