/**
 * Account Screen
 * User profile, orders, saved items, settings
 * Includes real-time loyalty points sync
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccountMenuSections } from '@/components/profile/account-menu';
import { type MenuItem, MenuSection } from '@/components/profile/MenuSection';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import { useMerchant } from '@/hooks';
import { supabase } from '@/lib/supabase';
import { type Customer, useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { customer, session } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      session: state.session,
    }))
  );
  const signOut = useAuthStore((state) => state.signOut);
  const { data: merchant } = useMerchant();
  const { isInitialized, user: authUser } = useAuthStatus();
  const safeCustomer = customer ?? null;
  const userMeta = session?.user?.user_metadata;
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
  const menuSections = getAccountMenuSections({
    canDeleteAccount: Boolean(authUser),
    hasCustomerProfile: Boolean(safeCustomer),
  });

  useEffect(() => {
    setLoyaltyPoints(safeCustomer?.loyalty_points);
  }, [safeCustomer?.loyalty_points]);

  useEffect(() => {
    if (!safeCustomer?.id) {
      return;
    }

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
        if (err) {
          console.error('Realtime subscription error:', err);
        }
      });

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [safeCustomer?.id]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!authUser) {
      router.replace('/(tabs)');
    }
  }, [authUser, isInitialized]);

  if (!isInitialized) {
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
      return;
    }

    if (item.route) {
      router.push(item.route as Href);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {effectiveCustomer ? (
          <ProfileHeader
            customer={effectiveCustomer}
            loyaltyPoints={loyaltyPoints}
          />
        ) : null}

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

        {merchant?.social_media ? (
          <SocialLinks
            socialMedia={merchant.social_media}
            phone={merchant.phone}
            colors={colors}
          />
        ) : null}

        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.signOutButton}
        >
          <Text style={[styles.signOutText, { color: colors.error }]}>
            Sign Out
          </Text>
        </Pressable>

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
  content: {
    paddingBottom: 60,
    paddingTop: 20,
  },
  signOutButton: {
    alignSelf: 'center',
    marginTop: 44,
    paddingHorizontal: 20,
    paddingVertical: 14,
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
