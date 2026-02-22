/**
 * Account Screen
 * User profile, orders, saved items, settings
 * Includes real-time loyalty points sync
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestBanner } from '@/components/profile/GuestBanner';
import { type MenuItem, MenuSection } from '@/components/profile/MenuSection';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { palette, RADIUS, SHADOWS } from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import { useMerchant } from '@/hooks/use-products';
import { supabase } from '@/lib/supabase';
import { type Customer, useAuthStore } from '@/stores/auth-store';

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { customer, session } = useAuthStore();
  const signOut = useAuthStore((state) => state.signOut);
  const { data: merchant } = useMerchant();

  // Bug #5 fix: Guard against null/undefined customer before accessing properties
  const safeCustomer = customer ?? null;

  // 2026 Fix: Fallback for when session exists but customer profile is loading
  // Bug #7 fix: Use optional chaining + typeof checks instead of unsafe `as string` casts
  const userMeta = session?.user?.user_metadata;
  // M2 fix: Use ?? instead of || for nullish coalescing
  const effectiveCustomer: Customer | null =
    safeCustomer ??
    (session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? '',
          first_name:
            typeof userMeta?.first_name === 'string'
              ? userMeta.first_name
              : undefined,
          last_name:
            typeof userMeta?.last_name === 'string'
              ? userMeta.last_name
              : undefined,
        }
      : null);

  const [loyaltyPoints, setLoyaltyPoints] = useState<number | undefined>(
    safeCustomer?.loyalty_points
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setLoyaltyPoints(safeCustomer?.loyalty_points);
  }, [safeCustomer?.loyalty_points]);

  useEffect(() => {
    if (!safeCustomer?.id) return;

    const channel = supabase
      .channel(`account-loyalty-${safeCustomer.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${safeCustomer.id}`,
        },
        (payload) => {
          if (payload.new && 'loyalty_points' in payload.new) {
            setLoyaltyPoints(payload.new.loyalty_points as number);
          }
        }
      )
      .subscribe((_status, err) => {
        if (err) console.error('Realtime subscription error:', err);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [safeCustomer?.id]);

  // Auth gating handled by tab layout listener — this is a fallback for edge cases
  // e.g., user signs out while already viewing this tab (tabPress listener won't fire)
  const { isInitialized, user: authUser } = useAuthStatus();

  // Defense-in-depth: if user signed out while on this tab, go to Home
  useEffect(() => {
    if (!authUser) {
      router.replace('/(tabs)');
    }
  }, [authUser]);

  // All hooks called — safe to early return now
  if (!isInitialized) {
    // Brief startup window — show spinner
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!authUser) {
    return null;
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as Href);
    }
  };

  const menuSections = [
    {
      title: 'Activities',
      items: [
        {
          id: 'orders',
          icon: 'receipt-outline',
          label: 'My Orders',
          subLabel: 'Track, return, or buy again',
          route: '/orders',
          color: palette.red[500],
        },
        {
          id: 'receipts',
          icon: 'document-text-outline',
          label: 'Receipts & Invoices',
          subLabel: 'View and download payment records',
          route: '/receipts',
          color: '#059669',
        },
        {
          id: 'saved',
          icon: 'heart-outline',
          label: 'Saved Items',
          subLabel: 'Your wishlisted products',
          route: '/saved',
          color: palette.red[500],
        },
        {
          id: 'wallet',
          icon: 'wallet-outline',
          label: 'Wallet & Rewards',
          subLabel: 'Manage balance and points',
          route: '/wallet',
          color: palette.amber[500],
        },
      ],
      visible: !!safeCustomer,
    },
    {
      title: 'Personal Info',
      items: [
        {
          id: 'addresses',
          icon: 'location-outline',
          label: 'Shipping Addresses',
          subLabel: 'Manage your delivery locations',
          route: '/addresses',
          color: palette.gray[600],
        },
        {
          id: 'notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          subLabel: 'Manage alerts and messages',
          route: '/notifications',
          color: palette.amber[500],
        },
      ],
      visible: !!safeCustomer,
    },
    {
      title: 'Support & Help',
      items: [
        {
          id: 'help',
          icon: 'help-circle-outline',
          label: 'Help Center',
          subLabel: 'FAQs, chat, and support',
          route: '/faq',
          color: '#3B82F6', // Blue
        },
        {
          id: 'repairs',
          icon: 'build-outline',
          label: 'Repairs & Services',
          subLabel: 'Device repair and restoration',
          route: '/repairs',
          color: palette.gray[600],
        },
        {
          id: 'settings',
          icon: 'settings-outline',
          label: 'App Settings',
          subLabel: 'Themes, notifications, and more',
          route: '/modal',
          color: palette.gray[500],
        },
        ...(session
          ? [
              {
                id: 'delete-account',
                icon: 'trash-outline',
                label: 'Delete Account',
                subLabel: 'Permanently remove your account',
                route: '/profile/delete-account',
                color: colors.error,
              },
            ]
          : []),
      ],
      visible: true,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }}
      >
        {effectiveCustomer ? (
          <ProfileHeader
            customer={effectiveCustomer}
            loyaltyPoints={loyaltyPoints}
          />
        ) : (
          <GuestBanner />
        )}

        {menuSections
          .filter((section) => section.visible)
          .map((section, idx) => (
            <MenuSection
              key={section.title}
              title={section.title}
              items={section.items}
              colors={colors}
              delayIndex={idx}
              onItemPress={handleMenuPress}
            />
          ))}

        {/* Social links */}
        {merchant?.social_media && (
          <SocialLinks
            socialMedia={merchant.social_media}
            phone={merchant.phone}
            colors={colors}
          />
        )}

        {/* Sign out — guarded by session, not customer record (2026 best practice:
             any authenticated user can sign out regardless of customer table state) */}
        {session && (
          <Animated.View
            entering={FadeInDown.delay(700).duration(400)}
            style={styles.signOutWrap}
          >
            <Pressable
              style={({ pressed }) => [
                styles.signOutCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {}
                  );
                }
                handleSignOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: `${colors.error}15` },
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={colors.error}
                />
              </View>
              <Text style={[styles.signOutText, { color: colors.error }]}>
                Sign Out
              </Text>
            </Pressable>
          </Animated.View>
        )}

        <Text style={[styles.version, { color: colors.textSecondary }]}>
          ENVIRONMENT: PRODUCTION • VERSION 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  signOutWrap: {
    marginTop: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    ...SHADOWS.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 32,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.4,
  },
});
