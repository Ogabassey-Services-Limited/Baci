import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import type { VariantOptionDraft } from '@/lib/variant-generation';
import { VARIANT_OPTION_NAME_SUGGESTIONS } from './variant-builder.helpers';

interface VariantOptionGroupEditorProps {
  colors: ThemeColors;
  index: number;
  onAddValue: (value: string) => void;
  onChangeName: (name: string) => void;
  onRemoveOption: () => void;
  onRemoveValue: (valueId: string) => void;
  option: VariantOptionDraft;
}

export function VariantOptionGroupEditor({
  colors,
  index,
  onAddValue,
  onChangeName,
  onRemoveOption,
  onRemoveValue,
  option,
}: VariantOptionGroupEditorProps) {
  const [valueDraft, setValueDraft] = useState('');
  const optionLabel = option.name.trim() || `Option ${index + 1}`;

  const commitValue = () => {
    const trimmed = valueDraft.trim();
    if (!trimmed) {
      return;
    }
    if (
      option.values.some(
        (optionValue) =>
          optionValue.value.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setValueDraft('');
      return;
    }
    onAddValue(trimmed);
    setValueDraft('');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <TextInput
          accessibilityLabel={`Option ${index + 1} name`}
          onChangeText={onChangeName}
          placeholder="Option name (e.g. Color)"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.nameInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={option.name}
        />
        <Pressable
          accessibilityLabel={`Remove option ${index + 1}`}
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={onRemoveOption}
          style={styles.removeOptionButton}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {option.name.trim() === '' ? (
        <View style={styles.suggestionRow}>
          {VARIANT_OPTION_NAME_SUGGESTIONS.map((suggestion) => (
            <Pressable
              accessibilityLabel={`Name option ${index + 1} ${suggestion}`}
              accessibilityRole="button"
              key={suggestion}
              onPress={() => onChangeName(suggestion)}
              style={[styles.suggestionChip, { borderColor: colors.border }]}
            >
              <Text style={[styles.suggestionText, { color: colors.primary }]}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {option.values.length > 0 ? (
        <View style={styles.valueRow}>
          {option.values.map((optionValue) => (
            <View
              key={optionValue.id}
              style={[
                styles.valueChip,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {optionValue.value}
              </Text>
              <Pressable
                accessibilityLabel={`Remove ${optionValue.value} from ${optionLabel}`}
                accessibilityRole="button"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                onPress={() => onRemoveValue(optionValue.id)}
              >
                <Ionicons name="close" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.addValueRow}>
        <TextInput
          accessibilityLabel={`Add value to ${optionLabel}`}
          blurOnSubmit={false}
          onChangeText={setValueDraft}
          onSubmitEditing={commitValue}
          placeholder="Add a value (e.g. Black) and press +"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          style={[
            styles.valueInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={valueDraft}
        />
        <Pressable
          accessibilityLabel={`Confirm value for ${optionLabel}`}
          accessibilityRole="button"
          onPress={commitValue}
          style={[styles.addValueButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addValueButton: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  addValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  nameInput: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    padding: SPACING.md,
  },
  removeOptionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xs,
  },
  suggestionChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  valueChip: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  valueChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  valueInput: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    padding: SPACING.md,
  },
  valueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
});
