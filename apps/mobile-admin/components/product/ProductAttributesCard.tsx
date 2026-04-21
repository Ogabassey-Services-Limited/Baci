import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { ProductVariantAttributeDraft } from './product-edit.types';

interface ProductAttributesCardProps {
  attributes: ProductVariantAttributeDraft[];
  colors: ThemeColors;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: 'key' | 'value', text: string) => void;
}

export function ProductAttributesCard({
  attributes,
  colors,
  onAdd,
  onRemove,
  onUpdate,
}: ProductAttributesCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Attributes</Text>
        <Pressable onPress={onAdd} style={styles.addButton}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={[styles.addLabel, { color: colors.primary }]}>Add</Text>
        </Pressable>
      </View>

      {attributes.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No attributes defined (e.g. Storage, RAM).
        </Text>
      ) : null}

      {attributes.map((attribute, index) => (
        <View key={attribute.id} style={styles.row}>
          <View style={styles.inputColumn}>
            <TextInput
              accessibilityLabel={`Attribute key ${index + 1}`}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={attribute.key}
              onChangeText={(text) => onUpdate(index, 'key', text)}
              placeholder="Key (e.g. Storage)"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.inputColumn}>
            <TextInput
              accessibilityLabel={`Attribute value ${index + 1}`}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={attribute.value}
              onChangeText={(text) => onUpdate(index, 'value', text)}
              placeholder="Value (e.g. 256GB)"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Pressable
            accessibilityLabel={`Remove attribute ${index + 1}`}
            accessibilityRole="button"
            onPress={() => onRemove(index)}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  addLabel: {
    fontWeight: '600',
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    padding: 12,
  },
  inputColumn: {
    flex: 1,
  },
  removeButton: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
