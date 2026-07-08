import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SelectedParentProduct } from '@/components/orders/new-order.types';
import type { ThemeColors } from '@/constants/theme';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import {
  buildVariantOptionGroups,
  completeSingleValueSelection,
  resolveSelectedVariant,
  type VariantOptionGroup,
  type VariantOptionSelection,
  type VariantOptionValue,
} from '@/lib/product-variant-option-selector';
import {
  type ProductVariantFixedOption,
  ProductVariantFixedOptions,
} from './ProductVariantFixedOptions';
import { ProductVariantSelectableGroup } from './ProductVariantSelectableGroup';
import { styles } from './product-variant-option-selector.styles';

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

function getVisibleVariantOptions(group: VariantOptionGroup) {
  return group.values.filter((option) => option.available || option.selected);
}

function isFixedVariantGroup(
  group: VariantOptionGroup,
  visibleValues: VariantOptionValue[]
) {
  return (
    group.values.length === 1 &&
    visibleValues.length === 1 &&
    Boolean(visibleValues[0]?.selected)
  );
}

function withFallbackImages(
  selectedVariant: AdminProductVariant,
  parentProduct: NonNullable<SelectedParentProduct>
): AdminProductVariant {
  return {
    ...selectedVariant,
    images:
      selectedVariant.images.length > 0
        ? selectedVariant.images
        : (parentProduct.images ?? []),
  };
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
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
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
  const visibleGroups = groups
    .map((group) => ({
      group,
      visibleValues: getVisibleVariantOptions(group),
    }))
    .filter(({ visibleValues }) => visibleValues.length > 0);
  const fixedOptions: ProductVariantFixedOption[] = visibleGroups
    .filter(({ group, visibleValues }) =>
      isFixedVariantGroup(group, visibleValues)
    )
    .map(({ group, visibleValues }) => ({
      key: group.key,
      label: group.label,
      value: visibleValues[0]?.label ?? '',
    }));
  const selectableGroups = visibleGroups.filter(
    ({ group, visibleValues }) => !isFixedVariantGroup(group, visibleValues)
  );
  const addButtonDisabled =
    !selectedVariant || selectedVariant.id === addedVariantId;

  const updateSelection = (key: string, value: string, available: boolean) => {
    const isSelected = completedSelection[key] === value;

    if (!(available || isSelected)) {
      return;
    }

    if (isSelected) {
      setSelection({
        ...selection,
        [key]: '',
      });
      setAddedVariantId(null);
      return;
    }

    const nextSelection = {
      ...selection,
      [key]: value,
    };
    const nextCompletedSelection = completeSingleValueSelection(
      variants,
      nextSelection
    );
    const nextSelectedVariant = resolveSelectedVariant(
      variants,
      nextCompletedSelection
    );

    setSelection(nextSelection);
    if (nextSelectedVariant && nextSelectedVariant.id !== addedVariantId) {
      setAddedVariantId(nextSelectedVariant.id);
      onAddProduct(withFallbackImages(nextSelectedVariant, parentProduct));
      return;
    }

    if (addedVariantId && !nextSelectedVariant) {
      setAddedVariantId(null);
    }
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

      <ProductVariantFixedOptions colors={colors} options={fixedOptions} />

      <BottomSheetScrollView
        contentContainerStyle={styles.groups}
        style={styles.optionsScroll}
        testID="variant-option-scroll-view"
      >
        {selectableGroups.map(({ group, visibleValues }) => {
          return (
            <ProductVariantSelectableGroup
              colors={colors}
              group={group}
              key={group.key}
              onSelect={updateSelection}
              visibleValues={visibleValues}
            />
          );
        })}
      </BottomSheetScrollView>

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
        <View
          style={[
            styles.addButton,
            {
              backgroundColor: colors.primary,
              opacity: addButtonDisabled ? 0.5 : 1,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Add selected variant"
            accessibilityRole="button"
            accessibilityState={{
              disabled: addButtonDisabled,
            }}
            disabled={addButtonDisabled}
            onPress={() => {
              if (!selectedVariant) {
                return;
              }

              setAddedVariantId(selectedVariant.id);
              onAddProduct(withFallbackImages(selectedVariant, parentProduct));
            }}
            style={styles.addButtonPressable}
          >
            <Text
              style={[styles.addButtonText, { color: colors.textOnPrimary }]}
            >
              Add
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
