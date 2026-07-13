import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { VariantEditorFields } from '@/components/product/VariantEditorFields';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductCondition } from '@/lib/product-condition';
import type {
  EditableProductVariant,
  VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import { getVariantSwatch } from '@/lib/variant-attribute-display';
import {
  getVariantSummaryLabel,
  getVariantSummaryMeta,
} from './product-edit.helpers';
import { productVariantRowStyles as styles } from './product-variant-row.styles';

interface ProductVariantRowProps {
  applyToSimilar?: { count: number; onApply: () => void };
  colors: ThemeColors;
  currencySymbol: string;
  isExpanded: boolean;
  onAddAttribute: () => void;
  onRemove: () => void;
  onRemoveAttribute: (attributeIndex: number) => void;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<EditableProductVariant>) => void;
  onUpdateAttribute: (
    attributeIndex: number,
    field: keyof VariantAttributeFormValue,
    value: string
  ) => void;
  onUpdateCondition: (condition?: EditableProductCondition) => void;
  variant: EditableProductVariant;
  variantIndex: number;
}

export function ProductVariantRow({
  applyToSimilar,
  colors,
  currencySymbol,
  isExpanded,
  onAddAttribute,
  onRemove,
  onRemoveAttribute,
  onToggleExpand,
  onUpdate,
  onUpdateAttribute,
  onUpdateCondition,
  variant,
  variantIndex,
}: ProductVariantRowProps) {
  const summaryLabel = getVariantSummaryLabel(variant, variantIndex);
  const summaryMeta = getVariantSummaryMeta(variant, currencySymbol);
  const swatch = getVariantSwatch(variant.attributes);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBg,
          borderColor: isExpanded ? colors.primary : colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityHint={
          isExpanded ? 'Collapses this variant' : 'Expands this variant to edit'
        }
        accessibilityLabel={`${summaryLabel}. ${summaryMeta}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={onToggleExpand}
        style={({ pressed }) => [
          styles.summaryRow,
          pressed && { opacity: 0.6 },
        ]}
      >
        {swatch ? (
          <View
            accessibilityElementsHidden
            style={[styles.swatch, { backgroundColor: swatch }]}
          />
        ) : (
          <View
            accessibilityElementsHidden
            style={[styles.swatchFallback, { backgroundColor: colors.card }]}
          >
            <Text
              style={[styles.swatchFallbackText, { color: colors.textMuted }]}
            >
              {variantIndex + 1}
            </Text>
          </View>
        )}

        <View style={styles.summaryContent}>
          <Text
            numberOfLines={1}
            style={[styles.summaryTitle, { color: colors.text }]}
          >
            {summaryLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.summarySubtitle, { color: colors.textSecondary }]}
          >
            {summaryMeta}
          </Text>
        </View>

        <Ionicons
          color={colors.textMuted}
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
        />
      </Pressable>

      {isExpanded ? (
        <VariantEditorFields
          applyToSimilar={applyToSimilar}
          colors={colors}
          currencySymbol={currencySymbol}
          onAddAttribute={onAddAttribute}
          onRemove={onRemove}
          onRemoveAttribute={onRemoveAttribute}
          onUpdate={onUpdate}
          onUpdateAttribute={onUpdateAttribute}
          onUpdateCondition={onUpdateCondition}
          variant={variant}
          variantIndex={variantIndex}
        />
      ) : null}
    </View>
  );
}
