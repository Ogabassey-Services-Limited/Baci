import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import {
  buildVariantPricingGroups,
  getAxisRawValue,
  getDefaultPricingAxisIds,
  getVariantAxes,
  type VariantPricingUpdate,
} from '@/lib/variant-group-pricing';
import { PriceInput } from './PriceInput';
import { variantGroupPricingSheetStyles as styles } from './variant-group-pricing-sheet.styles';

interface VariantGroupPricingSheetProps {
  colors: ThemeColors;
  currencySymbol: string;
  onApply: (updates: VariantPricingUpdate[]) => void;
  onClose: () => void;
  variants: EditableProductVariant[];
  visible: boolean;
}

interface GroupDraft {
  cost_price?: number;
  price?: number;
}

export function VariantGroupPricingSheet({
  colors,
  currencySymbol,
  onApply,
  onClose,
  variants,
  visible,
}: VariantGroupPricingSheetProps) {
  const axes = getVariantAxes(variants);
  const toggleableAxes = axes.filter((axis) => axis.values.length > 1);
  const defaultAxisIds = getDefaultPricingAxisIds(axes);
  const [selectedAxisIds, setSelectedAxisIds] = useState<string[]>(
    () => defaultAxisIds
  );
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({});
  const canonicalAxes = axes
    .map((axis) => [axis.id, [...axis.values].sort()] as const)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
  const canonicalVariants = variants
    .map((variant) => [
      variant.id ?? variant.client_id,
      axes
        .map((axis) => [axis.id, getAxisRawValue(variant, axis)] as const)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    ])
    .map((record) => JSON.stringify(record))
    .sort();
  const variantSetSignature = JSON.stringify({
    axes: canonicalAxes,
    variants: canonicalVariants,
  });
  const defaultAxisSignature = [...defaultAxisIds].sort().join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: variantSetSignature resets stale drafts when visible variant membership changes without changing default axes.
  useEffect(() => {
    if (visible) {
      setSelectedAxisIds(
        defaultAxisSignature ? defaultAxisSignature.split('|') : []
      );
      setDrafts({});
    }
  }, [variantSetSignature, defaultAxisSignature, visible]);

  const selectedAxes = axes.filter((axis) => selectedAxisIds.includes(axis.id));
  const groups = buildVariantPricingGroups(variants, selectedAxes);

  const toggleAxis = (axisId: string) => {
    setSelectedAxisIds((previous) =>
      previous.includes(axisId)
        ? previous.filter((id) => id !== axisId)
        : [...previous, axisId]
    );
    // Groups change shape with the axes, so pending edits no longer apply.
    setDrafts({});
  };

  const setDraft = (groupKey: string, patch: GroupDraft) => {
    setDrafts((previous) => ({
      ...previous,
      [groupKey]: { ...previous[groupKey], ...patch },
    }));
  };

  const updates: VariantPricingUpdate[] = groups.flatMap((group) => {
    const draft = drafts[group.key];
    if (
      !draft ||
      (draft.price === undefined && draft.cost_price === undefined)
    ) {
      return [];
    }
    return [
      {
        cost_price: draft.cost_price,
        indexes: group.indexes,
        price: draft.price,
      },
    ];
  });
  const affectedCount = updates.reduce(
    (total, update) => total + update.indexes.length,
    0
  );

  const handleApply = () => {
    if (updates.length === 0) {
      return;
    }
    onApply(updates);
    onClose();
  };

  return (
    <AppPageSheet
      footer={
        <Pressable
          accessibilityLabel={
            affectedCount > 0
              ? `Apply prices to ${affectedCount} variants`
              : 'Apply prices'
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: updates.length === 0 }}
          disabled={updates.length === 0}
          onPress={handleApply}
          style={[
            styles.applyButton,
            {
              backgroundColor:
                updates.length > 0 ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.applyText, { color: colors.textOnPrimary }]}>
            {affectedCount > 0
              ? `Apply to ${affectedCount} variant${affectedCount === 1 ? '' : 's'}`
              : 'Edit a price to apply'}
          </Text>
        </Pressable>
      }
      onClose={onClose}
      title="Set prices"
      visible={visible}
    >
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        Pick what actually changes the price. Matching variants share one row —
        set it once and every colour (or other option) gets it.
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        Price varies by
      </Text>
      <View style={styles.axisRow}>
        {toggleableAxes.map((axis) => {
          const isSelected = selectedAxisIds.includes(axis.id);
          return (
            <Pressable
              accessibilityLabel={`Price varies by ${axis.label}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={axis.id}
              onPress={() => toggleAxis(axis.id)}
              style={[
                styles.axisChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.axisChipText,
                  { color: isSelected ? colors.textOnPrimary : colors.text },
                ]}
              >
                {axis.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.groupList}>
        {groups.map((group) => {
          const draft = drafts[group.key];
          return (
            <View
              key={group.key}
              style={[
                styles.groupCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.groupHeader}>
                <Text
                  numberOfLines={1}
                  style={[styles.groupLabel, { color: colors.text }]}
                >
                  {group.label}
                </Text>
                <Text
                  style={[styles.groupCount, { color: colors.textSecondary }]}
                >
                  {group.indexes.length} variant
                  {group.indexes.length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.groupInputs}>
                <View style={styles.groupInput}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Selling
                  </Text>
                  <PriceInput
                    accessibilityLabel={`Selling price for ${group.label}`}
                    colors={colors}
                    currencySymbol={currencySymbol}
                    onChange={(price) => setDraft(group.key, { price })}
                    placeholder={group.commonPrice === null ? 'Mixed' : '0.00'}
                    value={
                      draft?.price ??
                      (group.commonPrice === null
                        ? undefined
                        : group.commonPrice)
                    }
                  />
                </View>
                <View style={styles.groupInput}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Cost
                  </Text>
                  <PriceInput
                    accessibilityLabel={`Cost price for ${group.label}`}
                    colors={colors}
                    currencySymbol={currencySymbol}
                    onChange={(cost_price) =>
                      setDraft(group.key, { cost_price })
                    }
                    placeholder={
                      group.commonCostPrice === null ? 'Mixed' : '0.00'
                    }
                    value={
                      draft?.cost_price ??
                      (group.commonCostPrice === null
                        ? undefined
                        : group.commonCostPrice)
                    }
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </AppPageSheet>
  );
}
