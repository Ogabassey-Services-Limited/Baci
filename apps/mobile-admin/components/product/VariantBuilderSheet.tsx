import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import type { ThemeColors } from '@/constants/theme';
import {
  EDITABLE_PRODUCT_CONDITIONS,
  type EditableProductCondition,
  formatProductCondition,
} from '@/lib/product-condition';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import {
  buildVariantsFromOptions,
  countVariantCombinations,
  MAX_GENERATED_VARIANTS,
  type VariantGenerationDefaults,
  type VariantOptionDraft,
} from '@/lib/variant-generation';
import { VariantOptionGroupEditor } from './VariantOptionGroupEditor';
import {
  createVariantOptionDraft,
  createVariantOptionValueDraft,
} from './variant-builder.helpers';
import { variantBuilderSheetStyles as styles } from './variant-builder-sheet.styles';

interface VariantBuilderSheetProps {
  colors: ThemeColors;
  // Consistency with the existing variants' condition axis:
  // 'free' (no real variants yet), 'required' (existing ones use conditions),
  // 'blocked' (existing ones have no condition, so new ones can't either).
  conditionMode?: 'blocked' | 'free' | 'required';
  defaults: VariantGenerationDefaults;
  initialConditions: EditableProductCondition[];
  onClose: () => void;
  onGenerate: (variants: EditableProductVariant[]) => void;
  visible: boolean;
}

export function VariantBuilderSheet({
  colors,
  conditionMode = 'free',
  defaults,
  initialConditions,
  onClose,
  onGenerate,
  visible,
}: VariantBuilderSheetProps) {
  const [options, setOptions] = useState<VariantOptionDraft[]>(() => [
    createVariantOptionDraft(),
  ]);
  const [conditions, setConditions] = useState<EditableProductCondition[]>(
    conditionMode === 'blocked' ? [] : initialConditions
  );

  useEffect(() => {
    if (visible) {
      setOptions([createVariantOptionDraft()]);
      setConditions(conditionMode === 'blocked' ? [] : initialConditions);
    }
  }, [conditionMode, initialConditions, visible]);

  const conditionsDisabled = conditionMode === 'blocked';
  const missingRequiredCondition =
    conditionMode === 'required' && conditions.length === 0;

  const combinationCount = countVariantCombinations(options, conditions);
  const isOverLimit = combinationCount > MAX_GENERATED_VARIANTS;
  const canGenerate =
    combinationCount > 0 && !isOverLimit && !missingRequiredCondition;
  const generateLabel = missingRequiredCondition
    ? 'Select a condition to continue'
    : isOverLimit
      ? 'Remove some values to continue'
      : combinationCount > 0
        ? `Generate ${combinationCount} variant${combinationCount === 1 ? '' : 's'}`
        : 'Add options to continue';

  const updateOption = (
    optionId: string,
    updater: (option: VariantOptionDraft) => VariantOptionDraft
  ) => {
    setOptions((previous) =>
      previous.map((option) =>
        option.id === optionId ? updater(option) : option
      )
    );
  };

  const toggleCondition = (condition: EditableProductCondition) => {
    if (conditionsDisabled) {
      return;
    }
    setConditions((previous) =>
      previous.includes(condition)
        ? previous.filter((entry) => entry !== condition)
        : [...previous, condition]
    );
  };

  const handleGenerate = () => {
    if (!canGenerate) {
      return;
    }
    onGenerate(buildVariantsFromOptions({ conditions, defaults, options }));
    onClose();
  };

  return (
    <AppPageSheet
      footer={
        <Pressable
          accessibilityLabel={generateLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGenerate }}
          disabled={!canGenerate}
          onPress={handleGenerate}
          style={[
            styles.generateButton,
            {
              backgroundColor: canGenerate ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.generateText, { color: colors.textOnPrimary }]}>
            {generateLabel}
          </Text>
        </Pressable>
      }
      onClose={onClose}
      title="Build variants"
      visible={visible}
    >
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        List options like Colour or Storage and their values. We create a
        variant for every combination, using your default prices.
      </Text>

      <View style={styles.optionList}>
        {options.map((option, index) => (
          <VariantOptionGroupEditor
            colors={colors}
            index={index}
            key={option.id}
            onAddValue={(value) =>
              updateOption(option.id, (current) => ({
                ...current,
                values: [
                  ...current.values,
                  createVariantOptionValueDraft(value),
                ],
              }))
            }
            onChangeName={(name) =>
              updateOption(option.id, (current) => ({ ...current, name }))
            }
            onRemoveOption={() =>
              setOptions((previous) =>
                previous.filter((entry) => entry.id !== option.id)
              )
            }
            onRemoveValue={(valueId) =>
              updateOption(option.id, (current) => ({
                ...current,
                values: current.values.filter((entry) => entry.id !== valueId),
              }))
            }
            option={option}
          />
        ))}
      </View>

      <Pressable
        accessibilityLabel="Add another option"
        accessibilityRole="button"
        onPress={() =>
          setOptions((previous) => [...previous, createVariantOptionDraft()])
        }
        style={[styles.addOptionButton, { borderColor: colors.primary }]}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={[styles.addOptionText, { color: colors.primary }]}>
          Add another option
        </Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        {conditionMode === 'required'
          ? 'Condition (required)'
          : conditionsDisabled
            ? 'Condition'
            : 'Condition (optional)'}
      </Text>
      {conditionsDisabled ? (
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Your existing variants do not use conditions, so new ones cannot
          either.
        </Text>
      ) : (
        <>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            {conditionMode === 'required'
              ? 'Your other variants use conditions — pick at least one.'
              : 'Selecting conditions creates a separate variant for each one.'}
          </Text>
          <View style={styles.conditionRow}>
            {EDITABLE_PRODUCT_CONDITIONS.map((condition) => {
              const isSelected = conditions.includes(condition);
              return (
                <Pressable
                  accessibilityLabel={`${formatProductCondition(condition)} condition`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  key={condition}
                  onPress={() => toggleCondition(condition)}
                  style={[
                    styles.conditionChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.conditionText,
                      {
                        color: isSelected ? colors.textOnPrimary : colors.text,
                      },
                    ]}
                  >
                    {formatProductCondition(condition)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {isOverLimit ? (
        <Text style={[styles.limitWarning, { color: colors.error }]}>
          That is {combinationCount} variants — more than the{' '}
          {MAX_GENERATED_VARIANTS} we can generate at once. Remove some values
          and try again.
        </Text>
      ) : null}
    </AppPageSheet>
  );
}
