/**
 * WelcomeHeader Component
 * Dashboard header with merchant name, avatar, and live status
 */

import { Ionicons } from '@expo/vector-icons';
import SafeImage from '@/components/ui/SafeImage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { BaciLogo } from '@/components/BaciLogo';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

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

  // Determine avatar type
  const isSvgDataUri = avatarUrl?.startsWith('data:image/svg');
  const isSvgUrl = avatarUrl?.endsWith('.svg');
  const canShowSvg = avatarUrl && isSvgUrl && !isSvgDataUri;
  const canShowImage = avatarUrl && !isSvgDataUri && !isSvgUrl;

  const renderAvatar = () => {
    if (canShowSvg) {
      // Remote SVG URL - use SvgUri
      return (
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.card, overflow: 'hidden' },
          ]}
        >
          <SvgUri uri={avatarUrl} width={48} height={48} />
        </View>
      );
    }
    if (canShowImage) {
      // Regular image URL (PNG, JPG, etc.)
      return (
        <SafeImage
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { backgroundColor: colors.card }]}
        />
      );
    }
    // Fallback to Baci logo
    return <BaciLogo size={48} borderRadius={RADIUS.full} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Pressable style={styles.avatarContainer} onPress={onAvatarPress}>
          {renderAvatar()}
          <View
            style={[
              styles.editBadge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            <Ionicons name="camera" size={10} color="#FFFFFF" />
          </View>
        </Pressable>

        <View style={styles.textContainer}>
          <View style={styles.urlRow}>
            <Text
              style={[styles.storeUrl, { color: colors.gold }]}
              numberOfLines={1}
            >
              {storeUrl}
            </Text>
            {isLive ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${colors.live}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: colors.live }]}>
                  LIVE
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${colors.textMuted}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: colors.textMuted }]}>
                  NOT LIVE
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.notificationButton, { backgroundColor: colors.card }]}
        onPress={onNotificationPress}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
        {notificationCount > 0 && (
          <View
            style={[styles.badge, { backgroundColor: colors.notification }]}
          >
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
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  storeUrl: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    maxWidth: '65%',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginLeft: 4,
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
