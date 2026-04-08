/**
 * DrawerMenu Component
 * Slide-in navigation sidebar matching web MobileMenu design
 *
 * Design: Clean, minimal aesthetic matching web storefront
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Logo } from '@/components/ui/Logo';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { useAuthStore } from '@/stores/auth-store';
import { useDrawerStore } from '@/stores/drawer-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 320);
const ANIMATION_DURATION = 300;

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  authRequired?: boolean;
}

const menuItems: MenuItem[] = [
  {
    label: 'My Account',
    icon: 'person-outline',
    path: '/account',
    authRequired: true,
  },
  { label: 'Orders', icon: 'bag-outline', path: '/orders' },
  { label: 'Receipts', icon: 'document-text-outline', path: '/receipts' },
  { label: 'Saved Items', icon: 'heart-outline', path: '/saved' },
  { label: 'IMEI Checker', icon: 'scan-outline', path: '/imei-check' },
  { label: 'Wallet', icon: 'wallet-outline', path: '/wallet' },
  { label: 'Address Book', icon: 'location-outline', path: '/addresses' },
  { label: 'Repairs', icon: 'construct-outline', path: '/repairs' },
  { label: 'Swap / Trade-in', icon: 'swap-horizontal-outline', path: '/swap' },
  { label: 'Help & Support', icon: 'help-circle-outline', path: '/faq' },
];

export function DrawerMenu() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isOpen, closeDrawer } = useDrawerStore(
    useShallow((s) => ({ isOpen: s.isOpen, closeDrawer: s.closeDrawer }))
  );
  const { user, signOut } = useAuthStore(
    useShallow((s) => ({ user: s.user, signOut: s.signOut }))
  );
  const isAuthenticated = !!user;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const currentYear = new Date().getFullYear();

  // Animation values
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.set(
        withTiming(0, {
          duration: ANIMATION_DURATION,
          easing: Easing.out(Easing.cubic),
        })
      );
      backdropOpacity.set(withTiming(1, { duration: ANIMATION_DURATION }));
    } else {
      translateX.set(
        withTiming(-DRAWER_WIDTH, {
          duration: ANIMATION_DURATION,
          easing: Easing.in(Easing.cubic),
        })
      );
      backdropOpacity.set(withTiming(0, { duration: ANIMATION_DURATION }));
    }
  }, [isOpen, translateX, backdropOpacity]);

  // Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && isOpen) {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          closeDrawer();
          return true;
        }
      );
      return () => backHandler.remove();
    }
  }, [isOpen, closeDrawer]);

  // Swipe gesture to close
  const panGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.set(Math.max(event.translationX, -DRAWER_WIDTH));
        backdropOpacity.set(
          interpolate(translateX.get(), [-DRAWER_WIDTH, 0], [0, 1])
        );
      }
    })
    .onEnd((event) => {
      if (event.translationX < -80 || event.velocityX < -500) {
        translateX.set(withTiming(-DRAWER_WIDTH, { duration: 200 }));
        backdropOpacity.set(withTiming(0, { duration: 200 }));
        runOnJS(closeDrawer)();
      } else {
        translateX.set(withTiming(0, { duration: 200 }));
        backdropOpacity.set(withTiming(1, { duration: 200 }));
      }
    });

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  // H4 fix: Use isOpen prop directly for pointerEvents since useDerivedValue
  // reads .value at render time (JS thread snapshot), not reactively during animation.

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const handleNavigate = (path: string) => {
    closeDrawer();
    router.push(path as import('expo-router').Href);
  };

  const confirmSignOut = () => {
    InteractionManager.runAfterInteractions(() => {
      signOut()
        .then(() => {
          router.replace('/(tabs)');
        })
        .catch((err: unknown) => {
          console.error('Sign-out failed:', err);
          Alert.alert(
            'Sign Out Failed',
            'Unable to complete sign out. Please try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: confirmSignOut },
            ]
          );
        });
    });
  };

  const handleSignOut = () => {
    closeDrawer();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: confirmSignOut,
      },
    ]);
  };

  const handleSignIn = () => {
    closeDrawer();
    router.push('/auth/login');
  };

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(`${path}/`);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — pointerEvents driven by isOpen prop for reliable tappability */}
      <Animated.View
        style={[styles.backdrop, backdropAnimatedStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer — L1 fix: Use theme-aware colors instead of hardcoded white */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          pointerEvents={isOpen ? 'auto' : 'none'}
          style={[
            styles.drawer,
            {
              paddingTop: insets.top,
              width: DRAWER_WIDTH,
              backgroundColor: colors.card,
            },
            drawerAnimatedStyle,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Logo
              width={120}
              height={24}
              color={colorScheme === 'dark' ? 'white' : 'black'}
            />
            <Pressable
              onPress={closeDrawer}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityLabel="Close menu"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Menu Content */}
          <ScrollView
            style={styles.menuList}
            contentContainerStyle={styles.menuListContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section Header */}
            <Text
              style={[styles.sectionHeader, { color: colors.textSecondary }]}
            >
              ACCOUNT
            </Text>

            {/* Menu Items — hide auth-required items for guests */}
            {menuItems
              .filter((item) => !item.authRequired || isAuthenticated)
              .map((item) => {
                const active = isActive(item.path);
                return (
                  <Pressable
                    key={item.path}
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    onPress={() => handleNavigate(item.path)}
                    accessibilityLabel={item.label}
                    accessibilityRole="menuitem"
                  >
                    <View style={styles.menuItemContent}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={active ? BRAND.primary : colors.icon}
                      />
                      <Text
                        style={[
                          styles.menuItemLabel,
                          { color: colors.text },
                          active && styles.menuItemLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                paddingBottom: insets.bottom + SPACING.md,
                borderTopColor: colors.border,
                backgroundColor: colors.muted,
              },
            ]}
          >
            {isAuthenticated ? (
              <Pressable
                style={[
                  styles.authButton,
                  { backgroundColor: colors.foreground },
                ]}
                onPress={handleSignOut}
                accessibilityLabel="Sign out"
                accessibilityRole="button"
              >
                <Text
                  style={[styles.authButtonText, { color: colors.background }]}
                >
                  Sign Out
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.authButton,
                  { backgroundColor: colors.foreground },
                ]}
                onPress={handleSignIn}
                accessibilityLabel="Login or Register"
                accessibilityRole="button"
              >
                <Text
                  style={[styles.authButtonText, { color: colors.background }]}
                >
                  Login / Register
                </Text>
              </Pressable>
            )}
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              v{appVersion} • &copy; {currentYear} Ogabassey
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: `${BRAND.primary}10`,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  menuItemLabelActive: {
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  authButton: {
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  authButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  versionText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
});
