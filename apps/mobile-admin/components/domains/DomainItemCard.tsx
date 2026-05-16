import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Domain } from './domain-types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function getStatusColors(
  status: Domain['status'],
  colors: ThemeColors
): { bg: string; fg: string } {
  switch (status) {
    case 'active':
      return { bg: colors.successLight, fg: colors.success };
    case 'failed':
      return { bg: colors.errorLight, fg: colors.error };
    default:
      return { bg: colors.warningLight, fg: colors.warning };
  }
}

interface DomainItemCardProps {
  domain: Domain;
  onOpenOptions: (domain: Domain) => void;
  actionLoading: boolean;
}

export function DomainItemCard({
  domain,
  onOpenOptions,
  actionLoading,
}: DomainItemCardProps) {
  const { colors, shadows } = useTheme();
  const statusColors = getStatusColors(domain.status, colors);

  return (
    <View
      style={[styles.domainCard, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.domainInfo}>
        <View style={styles.domainHeader}>
          <View
            style={[styles.iconContainer, { backgroundColor: statusColors.bg }]}
          >
            <Ionicons name="globe-outline" size={24} color={statusColors.fg} />
          </View>

          <View>
            <Text style={[styles.domainName, { color: colors.text }]}>
              {domain.domain}
            </Text>
            <View style={styles.badgesRow}>
              {domain.is_primary && (
                <View
                  style={[
                    styles.primaryBadge,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text
                    style={[styles.primaryBadgeText, { color: colors.primary }]}
                  >
                    Primary
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColors.bg },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColors.fg }]}>
                  {domain.status.charAt(0).toUpperCase() +
                    domain.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        style={styles.optionsButton}
        onPress={() => onOpenOptions(domain)}
        disabled={actionLoading}
        accessibilityRole="button"
        accessibilityLabel={`Open options for ${domain.domain}`}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  domainCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainInfo: {
    flex: 1,
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  domainName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  optionsButton: {
    padding: SPACING.sm,
  },
});
