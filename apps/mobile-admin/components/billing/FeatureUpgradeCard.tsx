import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

type FeatureUpgradeCardProps = {
  actionLabel?: string;
  colors: ThemeColors;
  description: string;
  onUpgrade: () => void;
  title: string;
};

export function FeatureUpgradeCard({
  actionLabel = 'Upgrade to Baci Pro',
  colors,
  description,
  onUpgrade,
  title,
}: FeatureUpgradeCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: colors.goldLight }]}>
        <Ionicons name="diamond-outline" size={28} color={colors.gold} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>
      <Pressable
        accessibilityLabel={actionLabel}
        accessibilityRole="button"
        onPress={onUpgrade}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="arrow-up-circle-outline" size={18} color="#FFFFFF" />
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING.lg,
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  card: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    margin: SPACING.lg,
    padding: SPACING.xl,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 20,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 56,
    justifyContent: 'center',
    marginBottom: SPACING.md,
    width: 56,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    textAlign: 'center',
  },
});
