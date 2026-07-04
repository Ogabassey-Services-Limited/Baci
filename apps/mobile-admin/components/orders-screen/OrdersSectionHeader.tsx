import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { ThemeColors } from './types';

interface OrdersSectionHeaderProps {
  colors: ThemeColors;
  title: string;
}

export function OrdersSectionHeader({
  colors,
  title,
}: OrdersSectionHeaderProps) {
  return (
    <View
      style={[styles.sectionHeader, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
    zIndex: 10,
  },
  sectionHeaderText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
