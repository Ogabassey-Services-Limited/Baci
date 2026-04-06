import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConnectivityBanner } from '@/components/ConnectivityBanner';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';
import { NegotiationModal } from '@/components/modals/NegotiationModal';
import { CompactStackHeader } from '@/components/navigation/CompactStackHeader';
import { DrawerMenu } from '@/components/navigation/DrawerMenu';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { QueryProvider } from '@/lib/QueryProvider';

const OgabasseyLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BRAND.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const OgabasseyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: BRAND.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

interface RootLayoutNavProps {
  persistenceEnabled?: boolean;
}

export function RootLayoutNav({
  persistenceEnabled = true,
}: RootLayoutNavProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const enableConnectivityBanner = true;
  const enableChatWidget = true;
  const enableNegotiationModal = true;
  const enableDrawerMenu = true;

  // Auth guard handles sign out redirects before protected screens render.
  useAuthGuard();

  return (
    <QueryProvider persistenceEnabled={persistenceEnabled}>
      <GestureHandlerRootView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <SafeAreaProvider>
          <ThemeProvider
            value={
              colorScheme === 'dark' ? OgabasseyDarkTheme : OgabasseyLightTheme
            }
          >
            <SystemBars style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <View
              style={[styles.appShell, { backgroundColor: colors.background }]}
            >
              <GlobalErrorBoundary context="RootNavigation">
                <Stack
                  screenOptions={{
                    header: (props) => <CompactStackHeader {...props} />,
                    headerStyle: {
                      backgroundColor: colors.background,
                    },
                    headerTintColor: colors.text,
                    headerTitleStyle: {
                      fontWeight: '600',
                    },
                    headerShadowVisible: false,
                    contentStyle: {
                      backgroundColor: colors.background,
                    },
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                    headerBackTitle: '',
                  }}
                >
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
                        backgroundColor: colors.muted,
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
                </Stack>
              </GlobalErrorBoundary>
              {enableConnectivityBanner ? <ConnectivityBanner /> : null}
              {enableChatWidget ? <ChatWidget bottomOffset={140} /> : null}
              {enableNegotiationModal ? <NegotiationModal /> : null}
              {enableDrawerMenu ? <DrawerMenu /> : null}
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appShell: { flex: 1 },
});
