import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { useTheme } from '@/hooks/useTheme';

interface CreateCategoryModalProps {
  isSubmitting: boolean;
  name: string;
  onChangeName: (name: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  visible: boolean;
}

export function CreateCategoryModal({
  isSubmitting,
  name,
  onChangeName,
  onClose,
  onSubmit,
  visible,
}: CreateCategoryModalProps) {
  const { colors } = useTheme();
  const isSubmitDisabled = isSubmitting || !name.trim();
  const handleSubmit = () => {
    if (!isSubmitDisabled) {
      onSubmit();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAwareModalContainer align="center">
          <Pressable style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Create Category
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={name}
              onChangeText={onChangeName}
              placeholder="e.g. Electronics"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Category name"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Closes the create category dialog"
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleSubmit}
                disabled={isSubmitDisabled}
                accessibilityLabel={
                  isSubmitting ? 'Creating category' : 'Create category'
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitDisabled }}
                accessibilityHint="Creates the new category"
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text
                    style={[styles.submitText, { color: colors.textOnPrimary }]}
                  >
                    Create
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAwareModalContainer>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    padding: 12,
  },
  cancelText: {
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    padding: 12,
  },
  submitText: {
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
