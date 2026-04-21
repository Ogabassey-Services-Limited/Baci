import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { VariantConditionEditor } from '@/app/(admin)/product/VariantConditionEditor';
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
import { getVariantSummaryLabel } from './product-edit.helpers';
import { productVariantRowStyles as styles } from './product-variant-row.styles';

interface ProductVariantRowProps {
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

export function ProductVariantRow({
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
}: ProductVariantRowProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.text }]}>
            {getVariantSummaryLabel(variant, variantIndex)}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {variant.sku || 'No SKU yet'} • Stock: {variant.stock_quantity}
          </Text>
        </View>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.removeLabel, { color: colors.error }]}>
            Remove
          </Text>
        </Pressable>
      </View>

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

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Variant SKU
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={variant.sku}
        onChangeText={(text) => onUpdate({ sku: text })}
        placeholder="Optional variant SKU"
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Selling Price
          </Text>
          <PriceInput
            accessibilityLabel={`Selling price for variant ${variantIndex + 1}`}
            value={variant.price}
            onChange={(value) => onUpdate({ price: value })}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Cost Price
          </Text>
          <PriceInput
            accessibilityLabel={`Cost price for variant ${variantIndex + 1}`}
            value={variant.cost_price}
            onChange={(value) => onUpdate({ cost_price: value })}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Stock Quantity
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={
          variant.stock_quantity === 0 ? '' : variant.stock_quantity.toString()
        }
        onChangeText={(text) =>
          onUpdate({
            stock_quantity: Number.parseInt(text || '0', 10) || 0,
          })
        }
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.attributeHeader}>
        <Text style={[styles.attributeTitle, { color: colors.text }]}>
          Attributes
        </Text>
        <Pressable onPress={onAddAttribute} style={styles.addAttributeButton}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.addAttributeLabel, { color: colors.primary }]}>
            Add
          </Text>
        </Pressable>
      </View>

      {variant.attributes.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Add concrete values like Storage 128GB or Color Black.
        </Text>
      ) : null}

      {variant.attributes.map((attribute, attributeIndex) => (
        <View key={attribute.id} style={styles.attributeRow}>
          <View style={styles.attributeInput}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={attribute.key}
              onChangeText={(text) =>
                onUpdateAttribute(attributeIndex, 'key', text)
              }
              placeholder="Key (e.g. Storage)"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.attributeInput}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={attribute.value}
              onChangeText={(text) =>
                onUpdateAttribute(attributeIndex, 'value', text)
              }
              placeholder="Value (e.g. 256GB)"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Pressable
            accessibilityLabel={`Remove variant ${variantIndex + 1} attribute ${attributeIndex + 1}`}
            accessibilityRole="button"
            onPress={() => onRemoveAttribute(attributeIndex)}
            style={styles.attributeRemoveButton}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
