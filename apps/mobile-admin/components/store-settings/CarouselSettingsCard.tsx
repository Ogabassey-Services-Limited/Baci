import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  type ThemeColors,
  getShadows,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';

interface CarouselSettingsCardProps {
  colors: ThemeColors;
  shadows: ReturnType<typeof getShadows>;
  slideCount: number;
  onPress: () => void;
}

export function CarouselSettingsCard({
  colors,
  shadows,
  slideCount,
  onPress,
}: CarouselSettingsCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Homepage Carousel</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.cardHover : colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="images-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: colors.text }]}>Manage mobile carousel</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Currently {slideCount} mobile slide{slideCount === 1 ? '' : 's'} configured</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  row: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flexShrink: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
});
