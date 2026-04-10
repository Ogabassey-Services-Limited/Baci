/**
 * StaffAccountModal
 * Modal for creating a new staff payment account
 */

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
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { StaffMember } from '@/lib/types/staff';
import { HorizontalPicker } from './HorizontalPicker';
import type { Branch } from './types';

interface StaffAccountModalProps {
  visible: boolean;
  colors: ThemeColors;
  accountName: string;
  onAccountNameChange: (text: string) => void;
  selectedBranchId: string | null;
  onBranchSelect: (id: string | null) => void;
  selectedStaffId: string | null;
  onStaffSelect: (id: string | null) => void;
  branches: Branch[] | undefined;
  staffMembers: StaffMember[] | undefined;
  staffLoading: boolean;
  staffError: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function StaffAccountModal({
  visible,
  colors,
  accountName,
  onAccountNameChange,
  selectedBranchId,
  onBranchSelect,
  selectedStaffId,
  onStaffSelect,
  branches,
  staffMembers,
  staffLoading,
  staffError,
  isPending,
  onSubmit,
  onClose,
}: StaffAccountModalProps) {
  const branchOptions =
    branches?.map((branch) => ({
      id: branch.id,
      label: branch.name,
      accessibilityLabel: `Branch: ${branch.name}`,
    })) ?? [];

  const staffOptions =
    staffMembers?.map((staff) => ({
      id: staff.id,
      label: staff.name || staff.email,
      accessibilityLabel: `Staff: ${staff.name || staff.email}`,
    })) ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <KeyboardAwareModalContainer
          align="end"
          contentContainerStyle={styles.modalKeyboardContent}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create Staff Account
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
              placeholder="Account name (e.g. Kola's Account)"
              placeholderTextColor={colors.textMuted}
              value={accountName}
              onChangeText={onAccountNameChange}
            />

            <HorizontalPicker
              label="Assign to Branch (Optional)"
              groupAccessibilityLabel="Branch selection"
              options={branchOptions}
              selectedId={selectedBranchId}
              onSelect={onBranchSelect}
              noneLabel="No Branch"
              noneAccessibilityLabel="No branch assigned"
              colors={colors}
            />

            <HorizontalPicker
              label="Assign to Staff (Optional)"
              groupAccessibilityLabel="Staff selection"
              options={staffOptions}
              selectedId={selectedStaffId}
              onSelect={onStaffSelect}
              noneLabel="No Staff"
              noneAccessibilityLabel="No staff assigned"
              colors={colors}
              isLoading={staffLoading}
              loadingLabel="Loading staff..."
              hasError={staffError}
              errorLabel="Staff unavailable"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.cardHover },
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel staff account creation"
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                  isPending && styles.modalButtonDisabled,
                ]}
                onPress={onSubmit}
                disabled={isPending}
                accessibilityRole="button"
                accessibilityLabel="Create staff account"
                accessibilityState={{ disabled: isPending }}
              >
                {isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
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
        </KeyboardAwareModalContainer>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboardContent: {
    flexGrow: 1,
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
