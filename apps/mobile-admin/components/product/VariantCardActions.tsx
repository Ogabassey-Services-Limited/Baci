import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { productVariantsCardStyles as styles } from './product-variants-card.styles';

interface VariantCardActionsProps {
  colors: ThemeColors;
  onAddOne: () => void;
  onOpenBuilder: () => void;
}

export function VariantCardActions({
  colors,
  onAddOne,
  onOpenBuilder,
}: VariantCardActionsProps) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityLabel="Build variants from options"
        accessibilityRole="button"
        onPress={onOpenBuilder}
        style={[styles.primaryAction, { backgroundColor: colors.primary }]}
      >
        <Ionicons color={colors.textOnPrimary} name="grid-outline" size={18} />
        <Text
          style={[styles.primaryActionText, { color: colors.textOnPrimary }]}
        >
          Build variants
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Add product variant"
        accessibilityRole="button"
        onPress={onAddOne}
        style={[styles.secondaryAction, { borderColor: colors.border }]}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
          Add one
        </Text>
      </Pressable>
    </View>
  );
}
