import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { useComparisonStore } from '@/stores/comparison-store';
import type { Product } from '@/types/product';

interface CompareButtonProps {
  product: Product;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export function CompareButton({
  product,
  size = 'medium',
  showLabel = true,
}: CompareButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isInComparison = useComparisonStore((state) =>
    state.isInComparison(product.id)
  );
  const toggleComparison = useComparisonStore(
    (state) => state.toggleComparison
  );
  const canAdd = useComparisonStore((state) => state.canAdd());

  const handlePress = () => {
    if (!isInComparison && !canAdd) {
      Alert.alert(
        'Compare Limit',
        'You can compare up to 3 products. Remove one to add another.',
        [{ text: 'OK' }]
      );
      return;
    }

    toggleComparison(product);
  };

  const iconSize = size === 'small' ? 16 : 20;

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.button,
        size === 'small' && styles.buttonSmall,
        {
          backgroundColor: isInComparison
            ? `${BRAND.primary}15`
            : `${colors.textSecondary}10`,
          borderColor: isInComparison ? BRAND.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name={isInComparison ? 'checkmark-circle' : 'git-compare-outline'}
        size={iconSize}
        color={isInComparison ? BRAND.primary : colors.textSecondary}
      />
      {showLabel && (
        <Text
          style={[
            styles.label,
            size === 'small' && styles.labelSmall,
            { color: isInComparison ? BRAND.primary : colors.textSecondary },
          ]}
        >
          {isInComparison ? 'Added' : 'Compare'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  buttonSmall: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: 11,
  },
});
