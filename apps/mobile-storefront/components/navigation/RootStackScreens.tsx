import { Stack } from 'expo-router';

interface RootStackScreensProps {
  // Content background colour for screens that override the default shell
  // colour (currently just the utilities stack).
  mutedContentBackgroundColor: string;
}

/**
 * Full `<Stack.Screen>` manifest for the storefront root stack. Extracted
 * from `RootLayoutNav.tsx` so that file stays under the 300-line limit
 * required by `CLAUDE.md`. Each entry mirrors the manifest Expo Router
 * reads for that route.
 */
export function RootStackScreens({
  mutedContentBackgroundColor,
}: RootStackScreensProps) {
  return (
    <>
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          headerBackTitle: '',
          title: '',
        }}
      />
      <Stack.Screen
        name="product/[slug]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          title: 'Checkout',
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="order-success"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="auth/login"
        options={{
          title: '',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="orders/index"
        options={{
          title: 'My Orders',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="orders/[id]"
        options={{
          title: 'Order Details',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="receipts/index"
        options={{
          title: 'Receipts & Invoices',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="addresses/index"
        options={{
          title: 'My Addresses',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="addresses/[id]"
        options={({ route }) => ({
          title:
            (route.params as { id?: string })?.id === 'new'
              ? 'Add Address'
              : 'Edit Address',
        })}
      />
      <Stack.Screen
        name="settings/index"
        options={{
          title: 'App Settings',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen
        name="category/[slug]"
        options={{
          title: 'Category',
        }}
      />
      <Stack.Screen
        name="wallet/index"
        options={{
          title: 'Wallet & Rewards',
        }}
      />
      <Stack.Screen
        name="utilities"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: mutedContentBackgroundColor,
          },
        }}
      />
      <Stack.Screen
        name="swap/index"
        options={{
          title: 'Swap & Trade-in',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="imei-check/index"
        options={{
          title: 'IMEI Checker',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="repairs/index"
        options={{
          title: 'Repair Lab',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="saved/index"
        options={{
          title: 'Saved Items',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="compare/index"
        options={{
          title: 'Compare Products',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="bnpl-checkout/index"
        options={{
          title: 'Buy Now Pay Later',
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="crypto-payment/index"
        options={{
          title: 'Crypto Payment',
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{
          title: 'Edit Profile',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="faq/index"
        options={{
          title: 'Help & Support',
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
