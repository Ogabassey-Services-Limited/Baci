import Ionicons from '@react-native-vector-icons/ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import {
  createImeiRemediationClient,
  type MobileImeiRemediationOrder,
} from '@/lib/imei-remediation-client';
import { unlockOrderStyles as styles } from './unlock-orders-screen.styles';

function amount(order: MobileImeiRemediationOrder) {
  if (order.paymentCurrency === 'USDT' && order.amountUsdt !== null) {
    return `${order.amountUsdt.toFixed(2)} USDT`;
  }
  return order.amountNgn === null
    ? '—'
    : `₦${order.amountNgn.toLocaleString('en-NG')}`;
}

export function UnlockOrdersScreen({
  accessToken,
  apiBaseUrl,
}: {
  accessToken?: string;
  apiBaseUrl: string;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<MobileImeiRemediationOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    const client = createImeiRemediationClient({ accessToken, apiBaseUrl });
    const refresh = async () => {
      const result = await client.list();
      if (!cancelled) {
        setOrders(result);
        setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, apiBaseUrl]);

  return (
    <StorefrontScreenShell
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" color={colors.text} size={23} />
            </Pressable>
          ),
          title: 'Unlock orders',
        }}
      />
      {loading ? (
        <View
          accessibilityLabel="Loading unlock orders"
          style={styles.centered}
        >
          <ActivityIndicator color={BRAND.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            No unlock orders yet. Eligible clean-unlock services appear after a
            device check.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {orders.map((order) => (
            <View
              key={order.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.carrier, { color: BRAND.primary }]}>
                {order.carrier || 'Carrier unlock'}
              </Text>
              <Text style={[styles.device, { color: colors.text }]}>
                {order.deviceModel || 'Device unlock'}
              </Text>
              <View style={styles.meta}>
                <Text style={[styles.amount, { color: colors.text }]}>
                  {amount(order)}
                </Text>
                <Text style={[styles.status, { color: colors.textSecondary }]}>
                  {order.status.replaceAll('_', ' ')}
                </Text>
              </View>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                Usually {order.turnaround || 'carrier timing varies'}
              </Text>
              {order.customerMessage ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {order.customerMessage}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </StorefrontScreenShell>
  );
}
