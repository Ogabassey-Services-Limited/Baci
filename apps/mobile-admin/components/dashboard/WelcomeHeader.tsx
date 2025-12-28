/**
 * WelcomeHeader Component
 * Dashboard header with merchant name, avatar, and live status
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { BaciLogo } from '@/components/BaciLogo';

interface WelcomeHeaderProps {
  storeUrl: string;
  avatarUrl?: string;
  isLive?: boolean;
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
  notificationCount?: number;
}

export function WelcomeHeader({
  storeUrl,
  avatarUrl,
  isLive = false,
  onNotificationPress,
  onAvatarPress,
  notificationCount = 0,
}: WelcomeHeaderProps) {
  const { colors } = useTheme();

  // React Native Image can't render SVG data URIs, so skip them
  const canShowAvatar = avatarUrl && !avatarUrl.startsWith('data:image/svg');

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Pressable style={styles.avatarContainer} onPress={onAvatarPress}>
          {canShowAvatar ? (
            <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: colors.card }]} />
          ) : (
            <BaciLogo size={48} borderRadius={RADIUS.full} />
          )}
          {isLive && (
            <View style={[styles.liveBadge, { backgroundColor: colors.live, borderColor: colors.background }]}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.textContainer}>
          <Text style={[styles.storeUrl, { color: colors.gold }]} numberOfLines={1}>
            {storeUrl}
          </Text>
        </View>
      </View>

      <Pressable
        style={[styles.notificationButton, { backgroundColor: colors.card }]}
        onPress={onNotificationPress}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
        {notificationCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.notification }]}>
            <Text style={styles.badgeText}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  liveBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
  },
  liveText: {
    fontSize: 8,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  storeUrl: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
});
