import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductCondition } from '@/lib/product-condition';
import {
  type EditableProductVariant,
  getTotalVariantStock,
  type VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import { isPlaceholderVariant } from '@/lib/variant-generation';
import {
  filterVariantIndexes,
  getVariantAxes,
  type VariantFilterSelection,
  type VariantPricingUpdate,
} from '@/lib/variant-group-pricing';
import { PriceInput } from './PriceInput';
import { productVariantsCardStyles as styles } from './product-variants-card.styles';
import { ProductVariantsCardHeader } from './ProductVariantsCardHeader';
import { VariantAccordionList } from './VariantAccordionList';
import { VariantCardActions } from './VariantCardActions';
import { VariantBuilderSheet } from './VariantBuilderSheet';
import { VariantFilterChips } from './VariantFilterChips';
import { VariantGroupPricingSheet } from './VariantGroupPricingSheet';

const BULK_PRICING_MIN_VARIANTS = 4;
const FILTER_MIN_VARIANTS = 5;

interface ProductVariantsCardProps {
  colors: ThemeColors;
  currencySymbol: string;
  hasVariantConditionAxis: boolean;
  onAddVariant: () => string;
  onAddVariantAttribute: (variantIndex: number) => void;
  onApplyVariantPricing: (updates: VariantPricingUpdate[]) => void;
  onDefaultCostPriceChange: (value: number) => void;
  onDefaultPriceChange: (value: number) => void;
  onGenerateVariants: (variants: EditableProductVariant[]) => void;
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
  onApplyVariantPricing,
  onDefaultCostPriceChange,
  onDefaultPriceChange,
  onGenerateVariants,
  onRemoveVariant,
  onRemoveVariantAttribute,
  onUpdateVariant,
  onUpdateVariantAttribute,
  onUpdateVariantCondition,
  value,
  variants,
}: ProductVariantsCardProps) {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [isBuilderVisible, setIsBuilderVisible] = useState(false);
  const [isPricingVisible, setIsPricingVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [filterSelection, setFilterSelection] =
    useState<VariantFilterSelection>({});

  const totalStock = getTotalVariantStock(variants);
  const axes = getVariantAxes(variants);
  const canFilterVariants = variants.length >= FILTER_MIN_VARIANTS;
  const activeFilterSelection = canFilterVariants ? filterSelection : {};
  const hasActiveFilter = axes.some((axis) => activeFilterSelection[axis.id]);
  const visibleIndexes = hasActiveFilter
    ? filterVariantIndexes(variants, axes, activeFilterSelection)
    : variants.map((_, index) => index);

  const existingConditions = Array.from(
    new Set(
      variants
        .map((variant) => variant.condition)
        .filter((condition): condition is EditableProductCondition =>
          Boolean(condition)
        )
    )
  );

  // Keep the builder's condition choice consistent with the all-or-nothing
  // save rule: if real variants already exist, the builder must match whether
  // they use conditions (required) or not (blocked); otherwise it is free.
  const realVariants = variants.filter(
    (variant) => !isPlaceholderVariant(variant)
  );
  const conditionMode: 'blocked' | 'free' | 'required' =
    realVariants.length === 0
      ? 'free'
      : realVariants.some((variant) => variant.condition)
        ? 'required'
        : 'blocked';

  const handleAddVariant = () => {
    const newClientId = onAddVariant();
    if (newClientId) {
      setExpandedClientId(newClientId);
    }
  };

  const handleGenerate = (generated: EditableProductVariant[]) => {
    onGenerateVariants(generated);
    setExpandedClientId(null);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ProductVariantsCardHeader
        colors={colors}
        onToggleHelp={() => setShowHelp((previous) => !previous)}
        showHelp={showHelp}
        totalStock={totalStock}
        variantCount={variants.length}
      />

      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        Default prices
      </Text>
      <View style={styles.priceRow}>
        <View style={styles.halfInput}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Selling
          </Text>
          <PriceInput
            accessibilityLabel="Default selling price"
            colors={colors}
            currencySymbol={currencySymbol}
            onChange={onDefaultPriceChange}
            placeholder="0.00"
            value={value.price}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Cost
          </Text>
          <PriceInput
            accessibilityLabel="Default cost price"
            colors={colors}
            currencySymbol={currencySymbol}
            onChange={onDefaultCostPriceChange}
            placeholder="0.00"
            value={value.cost_price}
          />
        </View>
      </View>

      {variants.length >= BULK_PRICING_MIN_VARIANTS ? (
        <Pressable
          accessibilityHint="Set prices for groups of variants at once, e.g. all 128GB Used"
          accessibilityLabel="Set prices in bulk"
          accessibilityRole="button"
          onPress={() => setIsPricingVisible(true)}
          style={[styles.bulkButton, { borderColor: colors.primary }]}
        >
          <Ionicons
            color={colors.primary}
            name="pricetags-outline"
            size={16}
          />
          <Text style={[styles.bulkButtonText, { color: colors.primary }]}>
            Set prices in bulk
          </Text>
        </Pressable>
      ) : null}

      {canFilterVariants ? (
        <VariantFilterChips
          axes={axes}
          colors={colors}
          onChange={setFilterSelection}
          selection={filterSelection}
        />
      ) : null}

      {hasActiveFilter ? (
        <Text style={[styles.showingText, { color: colors.textSecondary }]}>
          Showing {visibleIndexes.length} of {variants.length} variants
        </Text>
      ) : null}

      {variants.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No variants yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Build them from options like Colour or Storage, or add one at a
            time.
          </Text>
        </View>
      ) : (
        <VariantAccordionList
          colors={colors}
          currencySymbol={currencySymbol}
          expandedClientId={expandedClientId}
          onAddVariantAttribute={onAddVariantAttribute}
          onApplyVariantPricing={onApplyVariantPricing}
          onRemoveVariant={onRemoveVariant}
          onRemoveVariantAttribute={onRemoveVariantAttribute}
          onToggleExpand={(clientId) =>
            setExpandedClientId((previous) =>
              previous === clientId ? null : clientId
            )
          }
          onUpdateVariant={onUpdateVariant}
          onUpdateVariantAttribute={onUpdateVariantAttribute}
          onUpdateVariantCondition={onUpdateVariantCondition}
          variants={variants}
          visibleIndexes={visibleIndexes}
        />
      )}

      <VariantCardActions
        colors={colors}
        onAddOne={handleAddVariant}
        onOpenBuilder={() => setIsBuilderVisible(true)}
      />

      {hasVariantConditionAxis ? (
        <Text style={[styles.conditionNote, { color: colors.textMuted }]}>
          Every variant needs a condition while condition-based pricing is on.
        </Text>
      ) : null}

      {isBuilderVisible ? (
        <VariantBuilderSheet
          colors={colors}
          conditionMode={conditionMode}
          defaults={{
            costPrice: value.cost_price,
            images: [],
            price: value.price,
          }}
          initialConditions={existingConditions}
          onClose={() => setIsBuilderVisible(false)}
          onGenerate={handleGenerate}
          visible={isBuilderVisible}
        />
      ) : null}

      {isPricingVisible ? (
        <VariantGroupPricingSheet
          colors={colors}
          currencySymbol={currencySymbol}
          onApply={onApplyVariantPricing}
          onClose={() => setIsPricingVisible(false)}
          variants={variants}
          visible={isPricingVisible}
        />
      ) : null}
    </View>
  );
}
