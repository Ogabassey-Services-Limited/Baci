import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

export interface ProductVariantFixedOption {
  key: string;
  label: string;
  value: string;
}

interface ProductVariantFixedOptionsProps {
  colors: Pick<
    ThemeColors,
    'border' | 'primary' | 'textOnPrimary' | 'textSecondary'
  >;
  options: ProductVariantFixedOption[];
}

export function ProductVariantFixedOptions({
  colors,
  options,
}: ProductVariantFixedOptionsProps) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.container, { borderBottomColor: colors.border }]}
      testID="variant-fixed-options"
    >
      <View style={styles.options}>
        {options.map((option) => (
          <View
            key={option.key}
            style={[
              styles.option,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: colors.textOnPrimary }]}
            >
              {option.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.value, { color: colors.textOnPrimary }]}
            >
              {option.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.72,
    textTransform: 'uppercase',
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
  },
});
