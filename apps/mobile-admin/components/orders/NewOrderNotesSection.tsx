import { Text, TextInput, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { styles } from './new-order.styles';

interface NewOrderNotesSectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderNotesSection({
  controller,
}: NewOrderNotesSectionProps) {
  const { colors, notes, setNotes } = controller;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
      <TextInput
        accessibilityLabel="Internal notes"
        multiline
        onChangeText={setNotes}
        placeholder="Add internal notes..."
        placeholderTextColor={colors.textMuted}
        style={[
          styles.notesInput,
          { backgroundColor: colors.card, color: colors.text },
        ]}
        textAlignVertical="top"
        value={notes}
      />
    </View>
  );
}
