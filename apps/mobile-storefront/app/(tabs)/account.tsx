/**
 * Account Screen
 * User profile, orders, saved items, settings
 * Includes real-time loyalty points sync
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  action?: () => void;
  badge?: number;
}

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const customer = useAuthStore((state) => state.customer);
  const _isLoading = useAuthStore((state) => state.isLoading);
  const signOut = useAuthStore((state) => state.signOut);

  // Real-time loyalty points (syncs when wallet screen updates)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | undefined>(
    customer?.loyalty_points
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Sync loyalty points from customer when it changes
  useEffect(() => {
    setLoyaltyPoints(customer?.loyalty_points);
  }, [customer?.loyalty_points]);

  // Real-time subscription for loyalty points updates
  useEffect(() => {
    if (!customer?.id) return;

    const channel = supabase
      .channel(`account-loyalty-${customer.id}`)
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
            console.log(
              'Account: Loyalty points updated:',
              payload.new.loyalty_points
            );
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

  const menuItems: MenuItem[] = [
    {
      id: 'orders',
      icon: 'receipt-outline',
      label: 'My Orders',
      route: '/orders',
    },
    {
      id: 'saved',
      icon: 'heart-outline',
      label: 'Saved Items',
      route: '/saved',
    },
    {
      id: 'addresses',
      icon: 'location-outline',
      label: 'Delivery Addresses',
      route: '/addresses',
    },
    {
      id: 'wallet',
      icon: 'wallet-outline',
      label: 'Wallet & Rewards',
      route: '/wallet',
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      label: 'Notifications',
      route: '/notifications',
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: 'Help & Support',
      route: '/help',
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      label: 'Settings',
      route: '/settings',
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [
        styles.menuItem,
        { borderBottomColor: colors.border },
        pressed && styles.menuItemPressed,
      ]}
      onPress={() => handleMenuPress(item)}
    >
      <View
        style={[
          styles.menuIconContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Ionicons name={item.icon} size={22} color={BRAND.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>
        {item.label}
      </Text>
      {item.badge && (
        <View style={[styles.badge, { backgroundColor: BRAND.primary }]}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  const renderGuestView = () => (
    <View style={styles.guestContainer}>
      <View
        style={[styles.guestIconContainer, { backgroundColor: colors.card }]}
      >
        <Ionicons
          name="person-outline"
          size={48}
          color={colors.textSecondary}
        />
      </View>
      <Text style={[styles.guestTitle, { color: colors.text }]}>
        Welcome to Ogabassey
      </Text>
      <Text style={[styles.guestSubtitle, { color: colors.textSecondary }]}>
        Sign in to track orders, save items, and earn rewards
      </Text>
      <Pressable
        style={[styles.signInButton, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/auth/login')}
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </Pressable>
      <Pressable
        style={[styles.createAccountButton, { borderColor: BRAND.primary }]}
        onPress={() => router.push('/auth/login')}
      >
        <Text style={[styles.createAccountText, { color: BRAND.primary }]}>
          Create Account
        </Text>
      </Pressable>
    </View>
  );

  const renderProfileHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
      {customer?.avatar_url ? (
        <Image source={{ uri: customer.avatar_url }} style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            { backgroundColor: BRAND.primaryLight },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: BRAND.primary }]}>
            {customer?.first_name?.[0] ||
              customer?.email?.[0]?.toUpperCase() ||
              'U'}
          </Text>
        </View>
      )}

      <View style={styles.profileInfo}>
        <Text style={[styles.profileName, { color: colors.text }]}>
          {customer?.first_name
            ? `${customer.first_name} ${customer.last_name || ''}`
            : 'Welcome!'}
        </Text>
        <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
          {customer?.email}
        </Text>
        {loyaltyPoints !== undefined && (
          <View style={styles.loyaltyBadge}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={[styles.loyaltyText, { color: colors.text }]}>
              {loyaltyPoints.toLocaleString()} points
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.editButton,
          { borderColor: colors.border },
          pressed && styles.editButtonPressed,
        ]}
        onPress={() => router.push('/profile/edit' as any)}
      >
        <Ionicons name="pencil" size={16} color={colors.text} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {customer ? (
          <>
            {renderProfileHeader()}

            <View
              style={[styles.menuContainer, { backgroundColor: colors.card }]}
            >
              {menuItems.map(renderMenuItem)}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.signOutButton,
                { borderColor: colors.error },
                pressed && styles.signOutButtonPressed,
              ]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.signOutText, { color: colors.error }]}>
                Sign Out
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {renderGuestView()}

            <View
              style={[styles.menuContainer, { backgroundColor: colors.card }]}
            >
              {menuItems
                .filter((item) => ['help', 'settings'].includes(item.id))
                .map(renderMenuItem)}
            </View>
          </>
        )}

        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          Ogabassey v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  guestIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  signInButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createAccountButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  createAccountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    marginBottom: 8,
  },
  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loyaltyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  menuContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
});
