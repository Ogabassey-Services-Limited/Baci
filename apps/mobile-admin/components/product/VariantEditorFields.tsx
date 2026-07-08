import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { VariantAttributesEditor } from '@/components/product/VariantAttributesEditor';
import { VariantConditionEditor } from '@/components/product/VariantConditionEditor';
import type { ThemeColors } from '@/constants/theme';
import {
  EDITABLE_PRODUCT_CONDITIONS,
  type EditableProductCondition,
  formatProductCondition,
} from '@/lib/product-condition';
import type {
  EditableProductVariant,
  VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import { PriceInput } from './PriceInput';
import { productVariantRowStyles as styles } from './product-variant-row.styles';

interface VariantEditorFieldsProps {
  /** Present when sibling variants (e.g. other colours of the same storage +
   * condition) have different pricing — one tap copies this row's prices. */
  applyToSimilar?: { count: number; onApply: () => void };
  colors: ThemeColors;
  currencySymbol: string;
  onAddAttribute: () => void;
  onRemove: () => void;
  onRemoveAttribute: (attributeIndex: number) => void;
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

export function VariantEditorFields({
  applyToSimilar,
  colors,
  currencySymbol,
  onAddAttribute,
  onRemove,
  onRemoveAttribute,
  onUpdate,
  onUpdateAttribute,
  onUpdateCondition,
  variant,
  variantIndex,
}: VariantEditorFieldsProps) {
  const textInputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <View
      style={[styles.editorBody, { borderTopColor: colors.border }]}
      testID={`variant-editor-${variantIndex}`}
    >
      <VariantConditionEditor
        colors={colors}
        conditionOptions={EDITABLE_PRODUCT_CONDITIONS}
        formatConditionLabel={formatProductCondition}
        updateVariantCondition={(_index, condition) =>
          onUpdateCondition(condition)
        }
        variant={variant}
        variantIndex={variantIndex}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Selling Price
          </Text>
          <PriceInput
            accessibilityLabel={`Selling price for variant ${variantIndex + 1}`}
            colors={colors}
            currencySymbol={currencySymbol}
            onChange={(value) => onUpdate({ price: value })}
            placeholder="0.00"
            value={variant.price}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Cost Price
          </Text>
          <PriceInput
            accessibilityLabel={`Cost price for variant ${variantIndex + 1}`}
            colors={colors}
            currencySymbol={currencySymbol}
            onChange={(value) => onUpdate({ cost_price: value })}
            placeholder="0.00"
            value={variant.cost_price}
          />
        </View>
      </View>

      {applyToSimilar ? (
        <Pressable
          accessibilityHint="Copies this variant's selling and cost price to similar variants"
          accessibilityLabel={`Apply this price to ${applyToSimilar.count} similar variant${applyToSimilar.count === 1 ? '' : 's'}`}
          accessibilityRole="button"
          onPress={applyToSimilar.onApply}
          style={({ pressed }) => [
            styles.similarChip,
            {
              backgroundColor: colors.primaryLight,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
          <Text style={[styles.similarChipText, { color: colors.primary }]}>
            Apply this price to {applyToSimilar.count} similar variant
            {applyToSimilar.count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Stock Quantity
          </Text>
          <TextInput
            accessibilityLabel={`Stock quantity for variant ${variantIndex + 1}`}
            keyboardType="numeric"
            onChangeText={(text) => {
              const parsedQuantity = Number.parseInt(text || '0', 10);
              onUpdate({
                stock_quantity: Math.max(
                  0,
                  Number.isNaN(parsedQuantity) ? 0 : parsedQuantity
                ),
              });
            }}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            style={textInputStyle}
            value={
              variant.stock_quantity === 0
                ? ''
                : variant.stock_quantity.toString()
            }
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            SKU (optional)
          </Text>
          <TextInput
            accessibilityLabel={`SKU for variant ${variantIndex + 1}`}
            onChangeText={(text) => onUpdate({ sku: text })}
            placeholder="Auto if blank"
            placeholderTextColor={colors.textSecondary}
            style={textInputStyle}
            value={variant.sku}
          />
        </View>
      </View>

      <VariantAttributesEditor
        attributes={variant.attributes}
        colors={colors}
        onAddAttribute={onAddAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onUpdateAttribute={onUpdateAttribute}
        variantIndex={variantIndex}
      />

      <Pressable
        accessibilityLabel={`Remove variant ${variantIndex + 1}`}
        accessibilityRole="button"
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeVariantButton,
          { borderColor: colors.error, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="trash-outline" size={16} color={colors.error} />
        <Text style={[styles.removeVariantLabel, { color: colors.error }]}>
          Remove variant
        </Text>
      </Pressable>
    </View>
  );
}
