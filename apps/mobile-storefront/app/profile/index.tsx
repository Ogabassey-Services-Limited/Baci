/**
 * Profile Screen
 * User profile with premium gradient header, loyalty rewards,
 * menu sections, social links, and sign-out.
 * Includes real-time loyalty points sync via Supabase.
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestBanner } from '@/components/profile/GuestBanner';
import { type MenuItem, MenuSection } from '@/components/profile/MenuSection';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { palette } from '@/constants/Colors';
import { useMerchant } from '@/hooks/use-products';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const customer = useAuthStore((state) => state.customer);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: merchant } = useMerchant();

  const [loyaltyPoints, setLoyaltyPoints] = useState<number | undefined>(
    customer?.loyalty_points
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Sync loyalty points from store
  useEffect(() => {
    setLoyaltyPoints(customer?.loyalty_points);
  }, [customer?.loyalty_points]);

  // Real-time loyalty points subscription
  useEffect(() => {
    if (!customer?.id) return;

    const channel = supabase
      .channel(`profile-loyalty-${customer.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${customer.id}`,
        },
        (payload) => {
          if (payload.new && 'loyalty_points' in payload.new) {
            setLoyaltyPoints(payload.new.loyalty_points as number);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [customer?.id]);

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
      visible: !!customer,
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
      visible: !!customer,
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
          color: '#3B82F6',
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
      ],
      visible: true,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Account',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {customer ? (
            <ProfileHeader customer={customer} loyaltyPoints={loyaltyPoints} />
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

          {/* Sign out */}
          {customer && (
            <Animated.View
              entering={FadeInDown.delay(700).duration(400)}
              style={styles.signOutWrap}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.signOutBtn,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light
                    ).catch(() => {});
                  }
                  handleSignOut();
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={colors.error}
                />
                <Text style={[styles.signOutText, { color: colors.error }]}>
                  Sign Out
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <Text style={[styles.version, { color: colors.textSecondary }]}>
            VERSION 1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { padding: 8 },
  scrollContent: {
    paddingBottom: 60,
    paddingTop: 16,
  },
  signOutWrap: {
    marginTop: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
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
