import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
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
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface BranchCreateModalColors {
  background: string;
  border: string;
  card: string;
  notification: string;
  primary: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  textSecondary: string;
}

interface BranchCreateModalProps {
  visible: boolean;
  onClose: () => void;
  branchName: string;
  setBranchName: (name: string) => void;
  branchAddress: string;
  setBranchAddress: (address: string) => void;
  nameError: string;
  setNameError: (error: string) => void;
  onSubmit: () => void | Promise<void>;
  isLoading: boolean;
  colors: BranchCreateModalColors;
}

export function BranchCreateModal({
  visible,
  onClose,
  branchName,
  setBranchName,
  branchAddress,
  setBranchAddress,
  nameError,
  setNameError,
  onSubmit,
  isLoading,
  colors,
}: BranchCreateModalProps) {
  const branchAddressRef = useRef<TextInput>(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={onClose}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
          accessibilityState={{ disabled: isLoading }}
        />
        <KeyboardAwareModalContainer
          align="center"
          contentContainerStyle={styles.modalKeyboardContent}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.card }]}
            accessibilityViewIsModal={true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Branch
              </Text>
              <Pressable
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                onPress={onClose}
                disabled={isLoading}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
                accessibilityState={{ disabled: isLoading }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Branch Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: nameError
                      ? colors.notification
                      : colors.border,
                  },
                ]}
                value={branchName}
                onChangeText={(text) => {
                  setBranchName(text);
                  setNameError('');
                }}
                placeholder="e.g. Lagos Main, Lekki Branch"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Branch name input"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => branchAddressRef.current?.focus()}
              />
              {nameError ? (
                <Text
                  style={[styles.errorText, { color: colors.notification }]}
                >
                  {nameError}
                </Text>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Address (Optional)
              </Text>
              <TextInput
                ref={branchAddressRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={branchAddress}
                onChangeText={setBranchAddress}
                placeholder="e.g. 123 Main Street, Lekki"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Branch address input"
                returnKeyType="done"
                onSubmitEditing={isLoading ? undefined : onSubmit}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  { backgroundColor: colors.background },
                  isLoading && styles.buttonDisabled,
                  pressed && !isLoading && { opacity: 0.7 },
                ]}
                onPress={onClose}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Cancel branch creation"
                accessibilityState={{ disabled: isLoading }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  isLoading && styles.buttonDisabled,
                  pressed && !isLoading && { opacity: 0.7 },
                ]}
                onPress={onSubmit}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={
                  isLoading ? 'Creating branch' : 'Create branch'
                }
                accessibilityState={{ busy: isLoading, disabled: isLoading }}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      { color: colors.textOnPrimary },
                    ]}
                  >
                    Create Branch
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  submitButton: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
