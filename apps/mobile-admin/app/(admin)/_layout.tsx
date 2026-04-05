import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme } from '@/hooks/useTheme';

export default function AdminLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    registerPush,
    isRegistered,
    isLoading: isPushLoading,
  } = usePushNotifications();
  const { colors } = useTheme();
  const { merchant } = useMerchant();

  // Auto-register for push notifications when authenticated and merchant is loaded.
  // isPushLoading guards against concurrent calls when registerPush is recreated each render.
  useEffect(() => {
    if (isAuthenticated && !isRegistered && !isPushLoading && merchant?.id) {
      registerPush();
    }
  }, [
    isAuthenticated,
    isRegistered,
    isPushLoading,
    registerPush,
    merchant?.id,
  ]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: 'Back',
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, title: 'Dashboard' }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{ title: 'Order Details', presentation: 'card' }}
        />
        <Stack.Screen
          name="order/new"
          options={{ title: 'New Order', presentation: 'card' }}
        />
        <Stack.Screen
          name="product/[id]"
          options={{ title: 'Edit Product', presentation: 'card' }}
        />
        <Stack.Screen
          name="scan"
          options={{ title: 'Scan Barcode', presentation: 'modal' }}
        />
        <Stack.Screen
          name="domains"
          options={{ headerShown: false, presentation: 'card' }}
        />

        {/* Sub-screens with headers enabled */}
        <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Stack.Screen name="blog" options={{ title: 'Blog' }} />
        <Stack.Screen name="customer" options={{ title: 'Customers' }} />
        <Stack.Screen name="discounts" options={{ title: 'Discounts' }} />
        <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />

        {/* Individual screens */}
        <Stack.Screen
          name="contact-support"
          options={{ title: 'Contact Support' }}
        />
        <Stack.Screen name="customize" options={{ title: 'Customize Store' }} />

        <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
        <Stack.Screen name="kyc" options={{ title: 'Identity Verification' }} />
        <Stack.Screen
          name="notifications"
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name="payment-methods"
          options={{ title: 'Payment Methods' }}
        />
        <Stack.Screen
          name="payout-settings"
          options={{ title: 'Payout Settings' }}
        />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen
          name="send-feedback"
          options={{ title: 'Send Feedback' }}
        />
        <Stack.Screen
          name="setup-checklist"
          options={{ title: 'Setup Checklist' }}
        />
        <Stack.Screen
          name="shipping"
          options={{ title: 'Shipping Settings' }}
        />
        <Stack.Screen name="staff" options={{ title: 'Staff Management' }} />
        <Stack.Screen
          name="staff-accounts"
          options={{ title: 'Payment Accounts' }}
        />
        <Stack.Screen name="negotiations" options={{ title: 'Negotiations' }} />
        <Stack.Screen
          name="store-settings"
          options={{ title: 'Store Settings' }}
        />
        <Stack.Screen name="tax" options={{ title: 'Tax Settings' }} />
        <Stack.Screen
          name="analytics-config"
          options={{ title: 'Analytics & Tracking' }}
        />
        <Stack.Screen
          name="sales-channels"
          options={{ title: 'Marketplaces' }}
        />
        <Stack.Screen name="social-media" options={{ title: 'Social Media' }} />
        <Stack.Screen name="subscribe" options={{ title: 'Subscribe' }} />
      </Stack>
    </ErrorBoundary>
  );
}
