import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductCondition } from '@/lib/product-condition';
import type {
  EditableProductVariant,
  VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import { PriceInput } from './PriceInput';
import { ProductVariantRow } from './ProductVariantRow';

interface ProductVariantsCardProps {
  colors: ThemeColors;
  currencySymbol: string;
  hasVariantConditionAxis: boolean;
  onAddVariant: () => void;
  onAddVariantAttribute: (variantIndex: number) => void;
  onDefaultCostPriceChange: (value: number) => void;
  onDefaultPriceChange: (value: number) => void;
  onRemoveVariant: (variantIndex: number) => void;
  onRemoveVariantAttribute: (
    variantIndex: number,
    attributeIndex: number
  ) => void;
  onUpdateVariant: (
    variantIndex: number,
    updates: Partial<EditableProductVariant>
  ) => void;
  onUpdateVariantAttribute: (
    variantIndex: number,
    attributeIndex: number,
    field: keyof VariantAttributeFormValue,
    value: string
  ) => void;
  onUpdateVariantCondition: (
    variantIndex: number,
    condition?: EditableProductCondition
  ) => void;
  variants: EditableProductVariant[];
  value: {
    cost_price: number;
    price: number;
  };
}

export function ProductVariantsCard({
  colors,
  currencySymbol,
  hasVariantConditionAxis,
  onAddVariant,
  onAddVariantAttribute,
  onDefaultCostPriceChange,
  onDefaultPriceChange,
  onRemoveVariant,
  onRemoveVariantAttribute,
  onUpdateVariant,
  onUpdateVariantAttribute,
  onUpdateVariantCondition,
  value,
  variants,
}: ProductVariantsCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Variants</Text>
        <Pressable
          accessibilityLabel="Add product variant"
          accessibilityRole="button"
          onPress={onAddVariant}
          style={styles.addButton}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={[styles.addLabel, { color: colors.primary }]}>
            Add Variant
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Parent search results stay fast, but pricing and stock now come from the
        structured variants below. The parent price is used as the default when
        adding new variants.
      </Text>
      {hasVariantConditionAxis ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Condition is now part of the variant identity. Every variant row needs
          a condition when you price by new, used, or open box.
        </Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Default Selling Price
          </Text>
          <PriceInput
            accessibilityLabel="Default selling price"
            value={value.price}
            onChange={onDefaultPriceChange}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Default Cost Price
          </Text>
          <PriceInput
            accessibilityLabel="Default cost price"
            value={value.cost_price}
            onChange={onDefaultCostPriceChange}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
      </View>

      {variants.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Add at least one variant before saving this parent product.
        </Text>
      ) : null}

      {variants.map((variant, variantIndex) => (
        <ProductVariantRow
          key={variant.client_id}
          colors={colors}
          currencySymbol={currencySymbol}
          onAddAttribute={() => onAddVariantAttribute(variantIndex)}
          onRemove={() => onRemoveVariant(variantIndex)}
          onRemoveAttribute={(attributeIndex) =>
            onRemoveVariantAttribute(variantIndex, attributeIndex)
          }
          onUpdate={(updates) => onUpdateVariant(variantIndex, updates)}
          onUpdateAttribute={(attributeIndex, field, nextValue) =>
            onUpdateVariantAttribute(
              variantIndex,
              attributeIndex,
              field,
              nextValue
            )
          }
          onUpdateCondition={(condition) =>
            onUpdateVariantCondition(variantIndex, condition)
          }
          variant={variant}
          variantIndex={variantIndex}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addLabel: {
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  description: {
    fontSize: 13,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 16,
  },
  halfInput: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
