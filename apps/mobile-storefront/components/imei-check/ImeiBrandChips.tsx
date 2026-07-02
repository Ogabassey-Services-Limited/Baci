import { IMEI_BRAND_FILTERS, type ImeiBrandFilter } from '@baci/shared/imei';
import { Pressable, ScrollView, Text } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

interface ImeiBrandChipsProps {
  colors: ImeiCheckerColors;
  selectedBrand: ImeiBrandFilter;
  onBrandSelect: (brand: ImeiBrandFilter) => void;
}

/** Fixed horizontal brand filter row (phones only). Pinned above the scroll. */
export function ImeiBrandChips({
  colors,
  selectedBrand,
  onBrandSelect,
}: ImeiBrandChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.brandFilterScroll}
      contentContainerStyle={styles.brandFilterRow}
    >
      {IMEI_BRAND_FILTERS.map((brand) => (
        <BrandChip
          key={brand.id}
          colors={colors}
          isSelected={selectedBrand === brand.id}
          label={brand.label}
          onPress={() => onBrandSelect(brand.id)}
        />
      ))}
    </ScrollView>
  );
}

function BrandChip({
  colors,
  isSelected,
  label,
  onPress,
}: {
  colors: ImeiCheckerColors;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
      style={[
        styles.brandFilterChip,
        {
          backgroundColor: isSelected
            ? withAlpha(BRAND.primary, 0.1)
            : colors.card,
          borderColor: isSelected ? BRAND.primary : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.brandFilterText,
          { color: isSelected ? BRAND.primary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
