import { View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductCondition } from '@/lib/product-condition';
import type {
  EditableProductVariant,
  VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import {
  getSimilarVariantIndexes,
  type VariantPricingUpdate,
} from '@/lib/variant-group-pricing';
import { ProductVariantRow } from './ProductVariantRow';
import { productVariantsCardStyles as styles } from './product-variants-card.styles';

interface VariantAccordionListProps {
  colors: ThemeColors;
  currencySymbol: string;
  expandedClientId: string | null;
  onAddVariantAttribute: (variantIndex: number) => void;
  onApplyVariantPricing: (updates: VariantPricingUpdate[]) => void;
  onRemoveVariant: (variantIndex: number) => void;
  onRemoveVariantAttribute: (
    variantIndex: number,
    attributeIndex: number
  ) => void;
  onToggleExpand: (clientId: string) => void;
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
  /** Real indexes into `variants` to render (already filtered). */
  visibleIndexes: number[];
}

export function VariantAccordionList({
  colors,
  currencySymbol,
  expandedClientId,
  onAddVariantAttribute,
  onApplyVariantPricing,
  onRemoveVariant,
  onRemoveVariantAttribute,
  onToggleExpand,
  onUpdateVariant,
  onUpdateVariantAttribute,
  onUpdateVariantCondition,
  variants,
  visibleIndexes,
}: VariantAccordionListProps) {
  return (
    <View style={styles.variantList}>
      {visibleIndexes.map((variantIndex) => {
        const variant = variants[variantIndex];
        const isExpanded = expandedClientId === variant.client_id;

        // Only the expanded row can propagate pricing, so only it pays for
        // the similarity scan.
        let applyToSimilar: { count: number; onApply: () => void } | undefined;
        if (isExpanded) {
          const similar = getSimilarVariantIndexes(variants, variantIndex);
          const hasDrift = similar.some(
            (index) =>
              variants[index].price !== variant.price ||
              variants[index].cost_price !== variant.cost_price
          );
          if (similar.length > 0 && hasDrift) {
            applyToSimilar = {
              count: similar.length,
              onApply: () =>
                onApplyVariantPricing([
                  {
                    cost_price: variant.cost_price,
                    indexes: similar,
                    price: variant.price,
                  },
                ]),
            };
          }
        }

        return (
          <ProductVariantRow
            applyToSimilar={applyToSimilar}
            colors={colors}
            currencySymbol={currencySymbol}
            isExpanded={isExpanded}
            key={variant.client_id}
            onAddAttribute={() => onAddVariantAttribute(variantIndex)}
            onRemove={() => onRemoveVariant(variantIndex)}
            onRemoveAttribute={(attributeIndex) =>
              onRemoveVariantAttribute(variantIndex, attributeIndex)
            }
            onToggleExpand={() => onToggleExpand(variant.client_id)}
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
        );
      })}
    </View>
  );
}
