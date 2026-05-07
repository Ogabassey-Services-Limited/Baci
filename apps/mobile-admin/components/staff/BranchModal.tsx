/**
 * BranchModal
 * Modal for creating a new branch location
 */

import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface BranchModalProps {
  visible: boolean;
  mode?: 'create' | 'edit';
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
  mode = 'create',
  colors,
  branchName,
  onBranchNameChange,
  branchCity,
  onBranchCityChange,
  isPending,
  onSubmit,
  onClose,
}: BranchModalProps) {
  const isSubmitDisabled = isPending || branchName.trim().length === 0;
  const isEditing = mode === 'edit';
  const dialogLabel = isEditing ? 'Edit branch' : 'Create branch';
  const title = isEditing ? 'Edit Branch' : 'Create Branch';
  const submitLabel = isEditing ? 'Save branch' : 'Create branch';
  const submitText = isEditing ? 'Save' : 'Create';
  const cancelLabel = isEditing
    ? 'Cancel branch edit'
    : 'Cancel branch creation';
  const sharedInputStyle: StyleProp<TextStyle> = [
    styles.input,
    {
      backgroundColor: colors.cardHover,
      color: colors.text,
      borderColor: colors.border,
    },
  ];

  return (
    <AppSheetModal
      accessibilityLabel={dialogLabel}
      onClose={onClose}
      scrollEnabled={false}
      sheetStyle={[styles.modalContent, { backgroundColor: colors.card }]}
      visible={visible}
    >
      <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
      <TextInput
        style={sharedInputStyle}
        placeholder="Branch name (e.g. Lagos Main)"
        placeholderTextColor={colors.textMuted}
        value={branchName}
        onChangeText={onBranchNameChange}
        accessibilityLabel="Branch name"
      />
      <TextInput
        style={sharedInputStyle}
        placeholder="City (optional)"
        placeholderTextColor={colors.textMuted}
        value={branchCity}
        onChangeText={onBranchCityChange}
        accessibilityLabel="Branch city"
      />
      <View style={styles.modalButtons}>
        <Pressable
          style={[styles.modalButton, { backgroundColor: colors.cardHover }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        >
          <Text style={[styles.modalButtonText, { color: colors.text }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.modalButton,
            { backgroundColor: colors.primary },
            isSubmitDisabled && styles.modalButtonDisabled,
          ]}
          onPress={onSubmit}
          disabled={isSubmitDisabled}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: isSubmitDisabled }}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text
              style={[styles.modalButtonText, { color: colors.textOnPrimary }]}
            >
              {submitText}
            </Text>
          )}
        </Pressable>
      </View>
    </AppSheetModal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    paddingBottom: SPACING.xl,
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
