import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface StoreLinkCardProps {
  primaryDomain: string | undefined;
  merchantSlug: string | undefined;
}

export function StoreLinkCard({
  primaryDomain,
  merchantSlug,
}: StoreLinkCardProps) {
  const { colors, shadows } = useTheme();

  const storeUrl =
    primaryDomain ||
    (merchantSlug ? `${merchantSlug}.usebaci.com` : 'Loading...');

  return (
    <View
      style={[styles.storeCard, { backgroundColor: colors.card }, shadows.sm]}
      accessibilityLabel={`Store link: ${storeUrl}`}
    >
      <View
        style={[styles.storeIcon, { backgroundColor: colors.primaryLight }]}
      >
        <Ionicons
          name="storefront"
          size={28}
          color={colors.primary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <View style={styles.storeInfo}>
        <Text style={[styles.storeLabel, { color: colors.text }]}>
          Baci Store Link
        </Text>
        <Text style={[styles.storeUrl, { color: colors.textSecondary }]}>
          {storeUrl}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  storeInfo: {},
  storeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: 2,
  },
  storeUrl: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
