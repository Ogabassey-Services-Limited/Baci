/**
 * StaffAccountModal
 * Modal for creating a new staff payment account
 */

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { StaffMember } from '@/lib/types/staff';
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

          {/* Branch Picker */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Assign to Branch (Optional)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroll}
            accessibilityRole="radiogroup"
            accessibilityLabel="Branch selection"
          >
            <Pressable
              style={[
                styles.pickerOption,
                {
                  backgroundColor: !selectedBranchId
                    ? `${colors.primary}10`
                    : 'transparent',
                  borderColor: !selectedBranchId
                    ? colors.primary
                    : colors.border,
                },
              ]}
              onPress={() => onBranchSelect(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: !selectedBranchId }}
              accessibilityLabel="No branch assigned"
            >
              <Text
                style={[
                  styles.pickerText,
                  {
                    color: !selectedBranchId ? colors.primary : colors.text,
                  },
                ]}
              >
                No Branch
              </Text>
            </Pressable>
            {branches?.map((branch) => (
              <Pressable
                key={branch.id}
                style={[
                  styles.pickerOption,
                  {
                    backgroundColor:
                      selectedBranchId === branch.id
                        ? `${colors.primary}10`
                        : 'transparent',
                    borderColor:
                      selectedBranchId === branch.id
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => onBranchSelect(branch.id)}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selectedBranchId === branch.id,
                }}
                accessibilityLabel={`Branch: ${branch.name}`}
              >
                <Text
                  style={[
                    styles.pickerText,
                    {
                      color:
                        selectedBranchId === branch.id
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  {branch.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Staff Picker */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Assign to Staff (Optional)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroll}
            accessibilityRole="radiogroup"
            accessibilityLabel="Staff selection"
          >
            <Pressable
              style={[
                styles.pickerOption,
                {
                  backgroundColor: !selectedStaffId
                    ? `${colors.primary}10`
                    : 'transparent',
                  borderColor: !selectedStaffId
                    ? colors.primary
                    : colors.border,
                },
              ]}
              onPress={() => onStaffSelect(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: !selectedStaffId }}
              accessibilityLabel="No staff assigned"
            >
              <Text
                style={[
                  styles.pickerText,
                  {
                    color: !selectedStaffId ? colors.primary : colors.text,
                  },
                ]}
              >
                No Staff
              </Text>
            </Pressable>
            {staffLoading ? (
              <View
                style={[
                  styles.pickerOption,
                  {
                    backgroundColor: colors.cardHover,
                    borderColor: colors.border,
                    opacity: 0.7,
                  },
                ]}
                accessibilityRole="status"
                accessibilityLabel="Loading staff members"
              >
                <Text
                  style={[styles.pickerText, { color: colors.textSecondary }]}
                >
                  Loading staff...
                </Text>
              </View>
            ) : null}
            {staffError ? (
              <View
                style={[
                  styles.pickerOption,
                  {
                    backgroundColor: colors.errorLight,
                    borderColor: colors.error,
                  },
                ]}
                accessibilityRole="alert"
                accessibilityLabel="Staff members failed to load"
              >
                <Text style={[styles.pickerText, { color: colors.error }]}>
                  Staff unavailable
                </Text>
              </View>
            ) : null}
            {staffMembers?.map((staff) => (
              <Pressable
                key={staff.id}
                style={[
                  styles.pickerOption,
                  {
                    backgroundColor:
                      selectedStaffId === staff.id
                        ? `${colors.primary}10`
                        : 'transparent',
                    borderColor:
                      selectedStaffId === staff.id
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => onStaffSelect(staff.id)}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selectedStaffId === staff.id,
                }}
                accessibilityLabel={`Staff: ${staff.name || staff.email}`}
              >
                <Text
                  style={[
                    styles.pickerText,
                    {
                      color:
                        selectedStaffId === staff.id
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  {staff.name || staff.email}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
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
  inputLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pickerScroll: {
    marginBottom: SPACING.sm,
  },
  pickerOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
