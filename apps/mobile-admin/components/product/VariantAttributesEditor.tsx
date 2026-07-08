import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import {
  getPairedMetaAttributeIndexes,
  getVariantSwatch,
  partitionVariantAttributes,
} from '@/lib/variant-attribute-display';
import type { VariantAttributeFormValue } from '@/lib/product-variant-form';
import { VARIANT_OPTION_NAME_SUGGESTIONS } from './variant-builder.helpers';

interface VariantAttributesEditorProps {
  attributes: VariantAttributeFormValue[];
  colors: ThemeColors;
  onAddAttribute: () => void;
  onRemoveAttribute: (attributeIndex: number) => void;
  onUpdateAttribute: (
    attributeIndex: number,
    field: keyof VariantAttributeFormValue,
    value: string
  ) => void;
  variantIndex: number;
}

export function VariantAttributesEditor({
  attributes,
  colors,
  onAddAttribute,
  onRemoveAttribute,
  onUpdateAttribute,
  variantIndex,
}: VariantAttributesEditorProps) {
  const { visible } = partitionVariantAttributes(attributes);
  const swatch = getVariantSwatch(attributes);
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Details</Text>
        <Pressable
          accessibilityLabel={`Add detail to variant ${variantIndex + 1}`}
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={onAddAttribute}
          style={styles.addButton}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.addLabel, { color: colors.primary }]}>Add</Text>
        </Pressable>
      </View>

      {visible.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Add what makes this variant unique, e.g. Storage 128GB or Color Black.
        </Text>
      ) : null}

      {visible.map(({ attribute, index }) => {
        const showSwatch = /colou?r/i.test(attribute.key) && Boolean(swatch);

        return (
          <View key={attribute.id ?? index} style={styles.attributeBlock}>
            <View style={styles.attributeRow}>
              <TextInput
                accessibilityLabel={`Attribute key for variant ${variantIndex + 1} item ${index + 1}`}
                onChangeText={(text) => onUpdateAttribute(index, 'key', text)}
                placeholder="Type (e.g. Storage)"
                placeholderTextColor={colors.textSecondary}
                style={[...inputStyle, styles.keyInput]}
                value={attribute.key}
              />
              <View style={styles.valueInputWrap}>
                {showSwatch ? (
                  <View
                    accessibilityElementsHidden
                    style={[
                      styles.swatch,
                      { backgroundColor: swatch ?? 'transparent' },
                    ]}
                  />
                ) : null}
                <TextInput
                  accessibilityLabel={`Attribute value for variant ${variantIndex + 1} item ${index + 1}`}
                  onChangeText={(text) =>
                    onUpdateAttribute(index, 'value', text)
                  }
                  placeholder="Value (e.g. 256GB)"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    ...inputStyle,
                    styles.valueInput,
                    showSwatch && styles.valueInputWithSwatch,
                  ]}
                  value={attribute.value}
                />
              </View>
              <Pressable
                accessibilityLabel={`Remove variant ${variantIndex + 1} attribute ${index + 1}`}
                accessibilityRole="button"
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                onPress={() => {
                  // Remove the colour and its paired color_hex together, in
                  // descending index order so each splice stays valid.
                  const targets = [
                    index,
                    ...getPairedMetaAttributeIndexes(attributes, index),
                  ].sort((a, b) => b - a);
                  for (const target of targets) {
                    onRemoveAttribute(target);
                  }
                }}
                style={styles.removeButton}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.error}
                />
              </Pressable>
            </View>

            {attribute.key.trim() === '' ? (
              <View style={styles.suggestionRow}>
                {VARIANT_OPTION_NAME_SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    accessibilityLabel={`Use ${suggestion} for variant ${variantIndex + 1} item ${index + 1}`}
                    accessibilityRole="button"
                    key={suggestion}
                    onPress={() => onUpdateAttribute(index, 'key', suggestion)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.suggestionText, { color: colors.primary }]}
                    >
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  attributeBlock: {
    marginBottom: SPACING.md,
  },
  attributeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  container: {
    marginTop: SPACING.sm,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    fontSize: 15,
    padding: SPACING.md,
  },
  keyInput: {
    flex: 1,
  },
  removeButton: {
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
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
    marginTop: SPACING.sm,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  swatch: {
    borderRadius: RADIUS.full,
    height: 18,
    left: SPACING.md,
    position: 'absolute',
    width: 18,
    zIndex: 1,
  },
  valueInput: {
    flex: 1,
  },
  valueInputWithSwatch: {
    paddingLeft: SPACING.md + 18 + SPACING.sm,
  },
  valueInputWrap: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
});
