import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConnectivityBanner } from '@/components/ConnectivityBanner';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';
import { NegotiationModal } from '@/components/modals/NegotiationModal';
import { DrawerMenu } from '@/components/navigation/DrawerMenu';
import { renderRootStackScreens } from '@/components/navigation/RootStackScreens';
import AppKeyboardProvider from '@/components/ui/AppKeyboardProvider';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET } from '@/constants/layout';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { CONFIG } from '@/lib/config';
import { getOptionalGestureHandlerRuntime } from '@/lib/optional-gesture-handler';
import { QueryProvider } from '@/lib/QueryProvider';
import { getTemplateConfig } from '@/lib/templates';

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
  const { GestureHandlerRootView } = getOptionalGestureHandlerRuntime();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const enableConnectivityBanner =
    template.features?.connectivityBanner ?? true;
  const enableChatWidget = template.features?.chatWidget ?? true;
  const enableNegotiationModal = template.features?.negotiationModal ?? true;
  const enableDrawerMenu = template.features?.drawerMenu ?? true;

  // Auth guard handles sign out redirects before protected screens render.
  useAuthGuard();

  return (
    <QueryProvider persistenceEnabled={persistenceEnabled}>
      <GestureHandlerRootView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <SafeAreaProvider>
          <AppKeyboardProvider>
            <ThemeProvider
              value={
                colorScheme === 'dark'
                  ? OgabasseyDarkTheme
                  : OgabasseyLightTheme
              }
            >
              <SystemBars style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <View
                style={[
                  styles.appShell,
                  { backgroundColor: colors.background },
                ]}
              >
                <GlobalErrorBoundary context="RootNavigation">
                  {/*
                   * No custom `header` function in screenOptions — that would
                   * make react-native-screens NativeStack reserve a header zone
                   * via additionalSafeAreaInsets on every screen, even ones
                   * with `headerShown: false`, which combined with screens'
                   * own `<SafeAreaView edges={['top']}>` produced ~120pt of
                   * stacked blank padding above content. Mirrors apps/mobile-admin
                   * which uses the native iOS UINavigationBar.
                   *
                   * Screens that need a custom JS header can opt in
                   * per-Stack.Screen via `options.header`. Inner-content
                   * customization (back button, title node, right action) is
                   * available via `headerLeft`, `headerRight`, `headerTitle`
                   * without triggering the inset reservation.
                   */}
                  <Stack
                    screenOptions={{
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
                    {renderRootStackScreens({
                      mutedContentBackgroundColor: colors.muted,
                    })}
                  </Stack>
                </GlobalErrorBoundary>
                {enableConnectivityBanner ? <ConnectivityBanner /> : null}
                {enableChatWidget ? (
                  <ChatWidget
                    bottomOffset={CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET}
                  />
                ) : null}
                {enableNegotiationModal ? <NegotiationModal /> : null}
                {enableDrawerMenu ? <DrawerMenu /> : null}
              </View>
            </ThemeProvider>
          </AppKeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appShell: { flex: 1 },
});
