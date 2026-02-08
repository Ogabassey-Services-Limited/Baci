/**
 * Account Screen
 * User profile, orders, saved items, settings
 * Includes real-time loyalty points sync
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, SHADOWS } from '@/constants/Colors';
import { useMerchant } from '@/hooks/use-products';
import { normalizeSocialUrl, type SocialPlatform } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

interface AccountMenuItem {
  id: string;
  icon: string;
  label: string;
  subLabel: string;
  color: string;
  badge?: number;
  action?: () => void;
  route?: string;
  visible?: boolean;
}

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const customer = useAuthStore((state) => state.customer);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: merchant } = useMerchant();

  const [loyaltyPoints, setLoyaltyPoints] = useState<number | undefined>(
    customer?.loyalty_points
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setLoyaltyPoints(customer?.loyalty_points);
  }, [customer?.loyalty_points]);

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
      ],
      visible: true,
    },
    {
      title: 'Connect With Us',
      items: [
        ...(merchant?.social_media
          ? Object.entries(merchant.social_media)
              .map(([platform, handle]) => {
                const url = normalizeSocialUrl(
                  handle,
                  platform as SocialPlatform
                );
                if (!url) return null;

                let icon = 'logo-instagram';
                let label =
                  platform.charAt(0).toUpperCase() + platform.slice(1);
                const subLabel = `@${handle} • Official`;
                let color = '#E1306C';

                switch (platform) {
                  case 'instagram':
                    icon = 'logo-instagram';
                    color = '#E1306C';
                    break;
                  case 'tiktok':
                    icon = 'logo-tiktok';
                    color = '#000000';
                    break;
                  case 'twitter':
                    icon = 'logo-twitter';
                    label = 'X (Twitter)';
                    color = '#000000';
                    break;
                  case 'facebook':
                    icon = 'logo-facebook';
                    color = '#1877F2';
                    break;
                  case 'youtube':
                    icon = 'logo-youtube';
                    color = '#FF0000';
                    break;
                  case 'snapchat':
                    icon = 'logo-snapchat';
                    color = '#FFFC00';
                    break;
                  case 'linkedin':
                    icon = 'logo-linkedin';
                    color = '#0A66C2';
                    break;
                  default:
                    return null;
                }

                return {
                  id: platform,
                  icon,
                  label,
                  subLabel,
                  action: () => Linking.openURL(url),
                  color,
                };
              })
              .filter((item): item is AccountMenuItem => !!item)
          : []),
        {
          id: 'whatsapp',
          icon: 'logo-whatsapp',
          label: 'WhatsApp Support',
          subLabel: 'Chat with our experts',
          action: () =>
            Linking.openURL(
              `https://wa.me/${merchant?.phone?.replace(/\D/g, '') || '2348146978921'}`
            ),
          color: '#25D366',
        },
      ],
      visible: true,
    },
  ];

  const handleMenuPress = (item: { action?: () => void; route?: string }) => {
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as Href);
    }
  };

  const renderMenuItem = (item: AccountMenuItem, isLast: boolean) => (
    <Pressable key={item.id} onPress={() => handleMenuPress(item)}>
      {({ pressed }) => (
        <View
          style={[
            styles.menuItem,
            !isLast && {
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
            pressed && styles.menuItemPressed,
          ]}
        >
          <View style={styles.menuItemLeft}>
            <View
              style={[
                styles.menuIconWrapper,
                { backgroundColor: `${item.color}15` },
              ]}
            >
              <Ionicons
                name={
                  item.icon as unknown as React.ComponentProps<
                    typeof Ionicons
                  >['name']
                }
                size={22}
                color={item.color}
              />
            </View>
            <View style={styles.menuTextContainer}>
              <Text
                style={[styles.menuLabel, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <Text
                style={[styles.menuSubLabel, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.subLabel}
              </Text>
            </View>
          </View>

          <View style={styles.menuItemRight}>
            {item.badge && item.badge > 0 && (
              <View style={[styles.badge, { backgroundColor: BRAND.primary }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </View>
      )}
    </Pressable>
  );

  const renderGuestView = () => (
    <View style={styles.guestCard}>
      <View style={styles.guestHeader}>
        <View
          style={[styles.guestIconBg, { backgroundColor: palette.red[50] }]}
        >
          <Ionicons name="person" size={40} color={BRAND.primary} />
        </View>
        <View style={styles.guestInfo}>
          <Text style={[styles.guestTitle, { color: colors.text }]}>
            Join the Elite
          </Text>
          <Text style={[styles.guestSubtitle, { color: colors.textSecondary }]}>
            Unlock tracking, rewards, and 24/7 tech support.
          </Text>
        </View>
      </View>

      <View style={styles.guestActions}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.primaryButtonText}>Sign In / Join Now</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderProfileHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
      <View style={styles.profileHeaderTop}>
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
              : 'Store Member'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {customer?.email}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.settingsButton,
            { borderColor: colors.border },
            pressed && styles.settingsButtonPressed,
          ]}
          onPress={() => router.push('/profile/edit' as Href)}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      {loyaltyPoints !== undefined && (
        <View
          style={[styles.pointsCard, { backgroundColor: palette.amber[50] }]}
        >
          <Ionicons name="sparkles" size={16} color={palette.amber[600]} />
          <Text style={[styles.pointsText, { color: palette.amber[800] }]}>
            Rewards Balance:{' '}
            <Text style={{ fontWeight: '800' }}>
              {loyaltyPoints.toLocaleString()} pts
            </Text>
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }}
      >
        {customer ? renderProfileHeader() : renderGuestView()}

        {menuSections
          .filter((section) => section.visible)
          .map((section) => (
            <View key={section.title} style={styles.sectionWrapper}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                {section.title}
              </Text>
              <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
                {section.items.map((item, idx) =>
                  renderMenuItem(item, idx === section.items.length - 1)
                )}
              </View>
            </View>
          ))}

        {customer && (
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
            onPress={handleSignOut}
          >
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Sign Out Securely
            </Text>
          </Pressable>
        )}

        <Text style={[styles.versionTag, { color: colors.textSecondary }]}>
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
  sectionWrapper: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  guestCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...SHADOWS.lg,
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  guestIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  guestInfo: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  guestSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  guestActions: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  profileHeader: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.md,
  },
  profileHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
    fontFamily: 'Inter_700Bold',
  },
  profileEmail: {
    fontSize: 13,
  },
  pointsCard: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonPressed: {
    opacity: 0.7,
  },
  menuCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    width: '100%',
    minHeight: 72,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  menuIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  menuTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    flexShrink: 0,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  logoutButton: {
    marginTop: 48,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutButtonPressed: {
    opacity: 0.6,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  versionTag: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 40,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.4,
  },
});
