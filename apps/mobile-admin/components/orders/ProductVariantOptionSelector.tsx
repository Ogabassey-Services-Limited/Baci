import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SelectedParentProduct } from '@/components/orders/new-order.types';
import type { ThemeColors } from '@/constants/theme';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import {
  buildVariantOptionGroups,
  completeSingleValueSelection,
  resolveSelectedVariant,
  type VariantOptionGroup,
  type VariantOptionSelection,
} from '@/lib/product-variant-option-selector';

interface ProductVariantOptionSelectorProps {
  colors: Pick<
    ThemeColors,
    | 'backgroundLight'
    | 'border'
    | 'card'
    | 'error'
    | 'primary'
    | 'text'
    | 'textMuted'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  formatPrice: (amount: number) => string;
  onAddProduct: (product: AdminProductVariant) => void;
  parentProduct: NonNullable<SelectedParentProduct>;
  variantOptionGroups?: VariantOptionGroup[];
  variants: AdminProductVariant[];
}

export function ProductVariantOptionSelector({
  colors,
  formatPrice,
  onAddProduct,
  parentProduct,
  variantOptionGroups,
  variants,
}: ProductVariantOptionSelectorProps) {
  const [selection, setSelection] = useState<VariantOptionSelection>({});
  const initialGroups =
    Object.keys(selection).length === 0 ? variantOptionGroups : undefined;
  const completedSelection = completeSingleValueSelection(
    variants,
    selection,
    initialGroups
  );
  const groups =
    completedSelection === selection && initialGroups
      ? initialGroups
      : buildVariantOptionGroups(variants, completedSelection);
  const selectedVariant = resolveSelectedVariant(variants, completedSelection);
  const displayPrice = selectedVariant?.price ?? parentProduct.price;

  const updateSelection = (key: string, value: string, available: boolean) => {
    setSelection((previous) => {
      const isSelected = previous[key] === value;

      if (!(available || isSelected)) {
        return previous;
      }

      return {
        ...previous,
        [key]: isSelected ? '' : value,
      };
    });
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.productHeader, { borderBottomColor: colors.border }]}
      >
        <Text
          numberOfLines={2}
          style={[styles.productName, { color: colors.text }]}
        >
          {parentProduct.name}
        </Text>
        <Text style={[styles.productPrice, { color: colors.textSecondary }]}>
          {formatPrice(displayPrice)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.groups}>
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
              {group.label}
            </Text>
            <View style={styles.options}>
              {group.values.map((option) => {
                const disabled = !(option.available || option.selected);

                return (
                  <Pressable
                    accessibilityLabel={`Select ${group.label} ${option.label}`}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled,
                      selected: option.selected,
                    }}
                    disabled={disabled}
                    key={`${group.key}:${option.value}`}
                    onPress={() =>
                      updateSelection(group.key, option.value, option.available)
                    }
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: option.selected
                          ? colors.primary
                          : colors.card,
                        borderColor: option.selected
                          ? colors.primary
                          : colors.border,
                        opacity:
                          option.available || option.selected
                            ? pressed
                              ? 0.72
                              : 1
                            : 0.42,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: option.selected
                            ? colors.textOnPrimary
                            : colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.selectionSummary}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Selected
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.summaryValue, { color: colors.text }]}
          >
            {selectedVariant?.name ?? 'Choose all options'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Add selected variant"
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedVariant }}
          disabled={!selectedVariant}
          onPress={() => {
            if (!selectedVariant) {
              return;
            }

            onAddProduct({
              ...selectedVariant,
              images:
                selectedVariant.images.length > 0
                  ? selectedVariant.images
                  : (parentProduct.images ?? []),
            });
          }}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.primary,
              opacity: selectedVariant ? (pressed ? 0.72 : 1) : 0.5,
            },
          ]}
        >
          <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  group: {
    gap: 10,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  groups: {
    gap: 20,
    padding: 16,
    paddingBottom: 24,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  selectionSummary: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
});
