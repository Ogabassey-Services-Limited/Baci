import { getCustomerDisplayName } from '@baci/shared';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';

// Helper to get currency symbol from merchant's payout_currency
const getCurrencySymbol = (currencyCode: string | null | undefined) => {
  const symbols: Record<string, string> = {
    NGN: '\u20A6',
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
  };
  return symbols[currencyCode || 'NGN'] || '\u20A6';
};

interface OrderSummary {
  id: string;
  order_number: string;
  shipping_status: string;
  created_at: string;
  total: number;
}

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shadows } = useTheme();
  const { merchant } = useMerchant();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const router = useRouter();

  const { data: customer, isLoading, error } = useCustomer(id || '');

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = () => {
    if (!customer) return '';
    return getCustomerDisplayName(customer);
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      // Remove '+' and any non-numeric characters for WhatsApp API
      const cleanPhone = customer.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleEmail = () => {
    if (customer?.email) {
      Linking.openURL(`mailto:${customer.email}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const deleteCustomer = useDeleteCustomer();

  if (!id) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: 'Error', headerBackTitle: 'Back' }} />
        <Text style={{ color: colors.text }}>Invalid customer ID</Text>
      </View>
    );
  }

  const handleDelete = () => {
    const displayName = getDisplayName();

    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete "${displayName}"?\n\nThis action will hide the customer from your list. Any order history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteCustomer.mutateAsync(id);
              Alert.alert(
                'Customer Deleted',
                result.hadOrders
                  ? `Customer has been removed. ${result.orderCount} order(s) are preserved in history.`
                  : 'Customer has been removed successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(admin)/(tabs)/customers'),
                  },
                ]
              );
            } catch (_error) {
              Alert.alert(
                'Error',
                'Failed to delete customer. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen
          options={{ title: 'Loading...', headerBackTitle: 'Back' }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: 'Error', headerBackTitle: 'Back' }} />
        <Text style={{ color: colors.text }}>Failed to load customer</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Customer Details',
          headerBackTitle: 'Back',
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <Pressable
                onPress={handleDelete}
                style={{ padding: SPACING.sm }}
                disabled={deleteCustomer.isPending}
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={
                    deleteCustomer.isPending ? colors.textMuted : colors.error
                  }
                />
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/customer/edit/[id]',
                    params: { id },
                  })
                }
                style={{ padding: SPACING.sm }}
              >
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={colors.primary}
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.headerProfile}>
            <View
              style={[
                styles.avatarLarge,
                { backgroundColor: colors.goldLight },
              ]}
            >
              <Text style={[styles.avatarTextLarge, { color: colors.gold }]}>
                {getInitials(getDisplayName())}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {getDisplayName()}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.joinedText, { color: colors.textSecondary }]}
                >
                  Joined {formatDate(customer.created_at)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.contactRow}>
            <View style={styles.contactItem}>
              <Text
                style={[styles.contactLabel, { color: colors.textSecondary }]}
              >
                Email
              </Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>
                {customer.email}
              </Text>
            </View>
            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.infoLight }]}
              onPress={handleEmail}
            >
              <Ionicons name="mail" size={20} color={colors.info} />
            </Pressable>
          </View>

          {customer.phone ? (
            <View style={styles.contactRow}>
              <View style={styles.contactItem}>
                <Text
                  style={[styles.contactLabel, { color: colors.textSecondary }]}
                >
                  Phone
                </Text>
                <Text style={[styles.contactValue, { color: colors.text }]}>
                  {customer.phone}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[
                    styles.iconButton,
                    { backgroundColor: colors.successLight },
                  ]}
                  onPress={handleWhatsApp}
                >
                  <Ionicons
                    name="logo-whatsapp"
                    size={20}
                    color={colors.success}
                  />
                </Pressable>
                <Pressable
                  style={[styles.iconButton, { backgroundColor: colors.card }]}
                  onPress={handleCall}
                >
                  <Ionicons name="call" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {customer.address ? (
            <View style={styles.contactRow}>
              <View style={styles.contactItem}>
                <Text
                  style={[styles.contactLabel, { color: colors.textSecondary }]}
                >
                  Address
                </Text>
                <Text style={[styles.contactValue, { color: colors.text }]}>
                  {customer.address}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <View
              style={[styles.statIcon, { backgroundColor: colors.goldLight }]}
            >
              <Ionicons name="receipt" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {customer.total_orders}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Orders
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <View
              style={[
                styles.statIcon,
                { backgroundColor: colors.successLight },
              ]}
            >
              <Ionicons name="wallet" size={20} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatCurrency(customer.total_spent)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Spent
            </Text>
          </View>

          {/* store_credit is part of Customer interface but using loyalty_points if preferred? 
              Let's show loyalty or credit if they exist, else verify interface */}
        </View>

        {/* Recent Orders */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Orders
        </Text>

        {customer.recent_orders && customer.recent_orders.length > 0 ? (
          <View style={styles.ordersList}>
            {customer.recent_orders.map((order: OrderSummary) => (
              <Pressable
                key={order.id}
                style={[
                  styles.orderCard,
                  { backgroundColor: colors.card },
                  shadows.sm,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/order/[id]',
                    params: { id: order.id },
                  })
                }
              >
                <View
                  style={[
                    styles.orderIcon,
                    {
                      backgroundColor:
                        order.shipping_status === 'delivered'
                          ? colors.successLight
                          : colors.background,
                    },
                  ]}
                >
                  <Ionicons
                    name="cube-outline"
                    size={20}
                    color={
                      order.shipping_status === 'delivered'
                        ? colors.success
                        : colors.textMuted
                    }
                  />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={[styles.orderNumber, { color: colors.text }]}>
                    {order.order_number}
                  </Text>
                  <Text
                    style={[styles.orderDate, { color: colors.textSecondary }]}
                  >
                    {formatDate(order.created_at)}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={[styles.orderAmount, { color: colors.text }]}>
                    {formatCurrency(order.total)}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Text
              style={[styles.emptyStateText, { color: colors.textSecondary }]}
            >
              No recent orders
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarTextLarge: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinedText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  contactItem: {
    flex: 1,
  },
  contactLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  ordersList: {
    gap: SPACING.md,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderAmount: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  emptyState: {
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.size.sm,
  },
});
