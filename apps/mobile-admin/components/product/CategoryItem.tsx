import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/components/product/product.shared';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface CategoryItemProps {
  item: Category;
  onPress: (id: string) => void;
}

export function CategoryItem({ item, onPress }: CategoryItemProps) {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Category: ${item.name}`}
      accessibilityRole="button"
      accessibilityHint="View products in this category"
    >
      <View
        style={[styles.categoryIcon, { backgroundColor: colors.goldLight }]}
      >
        <Ionicons name="folder-open" size={20} color={colors.gold} />
      </View>
      <Text style={[styles.categoryName, { color: colors.text }]}>
        {item.name}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 40,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: 40,
  },
  categoryName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 16,
  },
});
