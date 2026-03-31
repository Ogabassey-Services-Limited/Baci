/**
 * BranchModal
 * Modal for creating a new branch location
 */

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface BranchModalProps {
  visible: boolean;
  colors: ThemeColors;
  branchName: string;
  onBranchNameChange: (text: string) => void;
  branchCity: string;
  onBranchCityChange: (text: string) => void;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function BranchModal({
  visible,
  colors,
  branchName,
  onBranchNameChange,
  branchCity,
  onBranchCityChange,
  isPending,
  onSubmit,
  onClose,
}: BranchModalProps) {
  const cityInputRef = useRef<TextInput>(null);
  const isCreateDisabled = isPending || branchName.trim().length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Create Branch
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.cardHover,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Branch name (e.g. Lagos Main)"
            placeholderTextColor={colors.textMuted}
            value={branchName}
            onChangeText={onBranchNameChange}
            accessibilityLabel="Branch name"
            returnKeyType="next"
            onSubmitEditing={() => cityInputRef.current?.focus()}
          />
          <TextInput
            ref={cityInputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.cardHover,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="City (optional)"
            placeholderTextColor={colors.textMuted}
            value={branchCity}
            onChangeText={onBranchCityChange}
            accessibilityLabel="Branch city"
            returnKeyType="done"
          />
          <View style={styles.modalButtons}>
            <Pressable
              style={[
                styles.modalButton,
                { backgroundColor: colors.cardHover },
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel branch creation"
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalButton,
                { backgroundColor: colors.primary },
                isCreateDisabled && styles.modalButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={isCreateDisabled}
              accessibilityRole="button"
              accessibilityLabel="Create branch"
              accessibilityState={{ disabled: isCreateDisabled }}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Create
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
