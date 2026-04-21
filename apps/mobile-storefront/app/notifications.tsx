/**
 * Notifications Screen
 * Displays user notifications (order updates, promotions, etc.)
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Redirect, router, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { useAuthStore } from '@/stores/auth-store';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'promo' | 'system';
  read: boolean;
  createdAt: Date;
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);
  const { getListContentStyle } = useStorefrontInsets();

  // 2026 Best Practice: Declarative auth-gate with intent-preserving returnTo
  const { redirectTo } = useRequireAuth();

  // Placeholder notifications - in production, fetch from API
  const notifications: Notification[] = [];

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return 'cube-outline';
      case 'promo':
        return 'pricetag-outline';
      default:
        return 'notifications-outline';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      style={({ pressed }) => [
        styles.notificationItem,
        { backgroundColor: colors.card },
        !item.read && styles.unread,
        pressed && styles.pressed,
      ]}
      onPress={() => {
        if (item.type === 'order') {
          router.push('/orders');
        }
      }}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons name={getIcon(item.type)} size={24} color={BRAND.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={[styles.message, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.message}
        </Text>
      </View>
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="notifications-off-outline"
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No notifications yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {user
          ? "We'll notify you about order updates and special offers"
          : 'Sign in to receive order updates and special offers'}
      </Text>
    </View>
  );

  // Declarative auth-gate: redirect to login if not authenticated
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Notifications',
        }}
      />
      <FlashList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          getListContentStyle({ includeBottomInset: false }),
          notifications.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </StorefrontScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  signInButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
