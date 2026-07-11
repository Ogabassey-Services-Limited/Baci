import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { productVariantsCardStyles as styles } from './product-variants-card.styles';

interface ProductVariantsCardHeaderProps {
  colors: ThemeColors;
  onToggleHelp: () => void;
  showHelp: boolean;
  totalStock: number;
  variantCount: number;
}

export function ProductVariantsCardHeader({
  colors,
  onToggleHelp,
  showHelp,
  totalStock,
  variantCount,
}: ProductVariantsCardHeaderProps) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Variants</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {variantCount > 0
              ? `${variantCount} variant${variantCount === 1 ? '' : 's'} • ${totalStock} in stock`
              : 'Pricing and stock come from the variants you add'}
          </Text>
        </View>
        <Pressable
          accessibilityHint="Explains how variants and conditions work"
          accessibilityLabel="How variants work"
          accessibilityRole="button"
          accessibilityState={{ expanded: showHelp }}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={onToggleHelp}
        >
          <Ionicons
            color={colors.textMuted}
            name="information-circle-outline"
            size={22}
          />
        </Pressable>
      </View>

      {showHelp ? (
        <View
          style={[styles.helpBox, { backgroundColor: colors.inputBg }]}
          testID="variants-help"
        >
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Search results stay fast, but pricing and stock come from the
            structured variants below. Default prices are used when adding new
            variants.
          </Text>
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Condition is now part of the variant identity. Every variant needs a
            condition when you price by new, used, or open box.
          </Text>
        </View>
      ) : null}
    </>
  );
}
