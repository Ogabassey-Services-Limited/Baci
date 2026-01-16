import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { DARK_COLORS } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function AdminLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { registerPush, isRegistered } = usePushNotifications();

  // Auto-register for push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && !isRegistered) {
      registerPush();
    }
  }, [isAuthenticated, isRegistered, registerPush]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: DARK_COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={DARK_COLORS.primary} size="large" />
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
          headerStyle: { backgroundColor: DARK_COLORS.background }, // Use theme context if possible, but hardcode for now or import
          headerTintColor: '#FFF', // Assuming Dark Mode default for Admin
          headerShadowVisible: false,
          contentStyle: { backgroundColor: DARK_COLORS.background },
          headerBackTitle: 'Back', // Replaces "(tabs)" with "Back"
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

        {/* Catch-all for other screens moved here */}
        <Stack.Screen name="analytics" options={{ headerShown: false }} />
        <Stack.Screen name="blog" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
        <Stack.Screen name="discounts" options={{ headerShown: false }} />
        <Stack.Screen name="expenses" options={{ headerShown: false }} />

        {/* Individual screens */}
        <Stack.Screen
          name="contact-support"
          options={{ title: 'Contact Support' }}
        />
        <Stack.Screen name="customize" options={{ title: 'Customize Store' }} />
        <Stack.Screen name="discounts.tsx" options={{ title: 'Discounts' }} />
        {/* Wait, discounts is a folder AND a file?  
            Checking file list: 
            {"name":"discounts", "isDir":true} 
            {"name":"discounts.tsx", "sizeBytes":"8860"}
            This usually means discounts.tsx is the list and discounts/ is details, or vice versa.
        */}
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
          name="store-settings"
          options={{ title: 'Store Settings' }}
        />
        <Stack.Screen name="tax" options={{ title: 'Tax Settings' }} />
      </Stack>
    </ErrorBoundary>
  );
}
