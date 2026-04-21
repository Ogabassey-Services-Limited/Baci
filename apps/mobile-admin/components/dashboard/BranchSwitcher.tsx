/**
 * BranchSwitcher Component
 * Horizontal scrollable bar with branch pills for switching locations
 * 2026 Best Practice: Haptic feedback, accessibility labels, Zod validation
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  type CreateBranchInput,
  CreateBranchSchema,
  useActiveBranch,
  useCreateBranch,
} from '@/hooks/useBranches';
import { useTheme } from '@/hooks/useTheme';

export function BranchSwitcher() {
  const { colors, shadows } = useTheme();
  const { branches, activeBranch, setActiveBranch, hasBranches } =
    useActiveBranch();
  const createBranch = useCreateBranch();
  const isSubmittingRef = useRef(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const isCreateBranchLoading = createBranch.isPending || isSubmitting;

  const handleBranchPress = (branchId: string) => {
    // Haptic feedback on selection
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    setActiveBranch(branchId);
  };

  const handleCreatePress = () => {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setBranchName('');
    setBranchAddress('');
    setNameError('');
  };

  const handleCreateBranch = async () => {
    if (isSubmittingRef.current || createBranch.isPending) {
      return;
    }

    // Validate with Zod
    const input: CreateBranchInput = {
      name: branchName.trim(),
      address: branchAddress.trim() || undefined,
    };

    const result = CreateBranchSchema.safeParse(input);
    if (!result.success) {
      // Route errors to the correct field to avoid misleading UX
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      if (nameIssue) {
        setNameError(nameIssue.message);
      } else {
        // Show other field errors (e.g., address) in a generic alert
        Alert.alert(
          'Error',
          result.error.issues[0]?.message ?? 'Invalid input'
        );
      }
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createBranch.mutateAsync(result.data);
      Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      handleCloseModal();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create branch'
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Show "Add first branch" state when no branches exist
  if (!hasBranches) {
    return (
      <View style={[styles.container, { paddingHorizontal: SPACING.lg }]}>
        <Pressable
          style={({ pressed }) => [
            styles.addFirstBranch,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.sm,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleCreatePress}
          accessibilityRole="button"
          accessibilityLabel="Add your first branch location"
        >
          <Ionicons name="business-outline" size={20} color={colors.primary} />
          <Text style={[styles.addFirstText, { color: colors.text }]}>
            Add your first branch
          </Text>
          <Ionicons name="add-circle" size={20} color={colors.primary} />
        </Pressable>

        {/* Create Modal - must be rendered for the modal to work */}
        <CreateBranchModal
          visible={isModalVisible}
          onClose={handleCloseModal}
          branchName={branchName}
          setBranchName={setBranchName}
          branchAddress={branchAddress}
          setBranchAddress={setBranchAddress}
          nameError={nameError}
          setNameError={setNameError}
          onSubmit={handleCreateBranch}
          isLoading={isCreateBranchLoading}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {branches.map((branch) => {
          const isActive = branch.id === activeBranch?.id;
          return (
            <Pressable
              key={branch.id}
              style={({ pressed }) => [
                styles.branchPill,
                {
                  backgroundColor: isActive ? colors.primary : colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                },
                shadows.sm,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleBranchPress(branch.id)}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${branch.name} branch`}
              accessibilityHint="Double tap to set as active branch"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name="location"
                size={14}
                color={isActive ? colors.textOnPrimary : colors.primary}
              />
              <Text
                style={[
                  styles.branchName,
                  { color: isActive ? colors.textOnPrimary : colors.text },
                ]}
                numberOfLines={1}
              >
                {branch.name}
              </Text>
              {isActive && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.textOnPrimary}
                />
              )}
            </Pressable>
          );
        })}

        {/* Add Branch Button */}
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.sm,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleCreatePress}
          accessibilityRole="button"
          accessibilityLabel="Add new branch"
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>
            Add
          </Text>
        </Pressable>
      </ScrollView>

      {/* Create Modal */}
      <CreateBranchModal
        visible={isModalVisible}
        onClose={handleCloseModal}
        branchName={branchName}
        setBranchName={setBranchName}
        branchAddress={branchAddress}
        setBranchAddress={setBranchAddress}
        nameError={nameError}
        setNameError={setNameError}
        onSubmit={handleCreateBranch}
        isLoading={isCreateBranchLoading}
        colors={colors}
      />
    </View>
  );
}

// Extracted modal component for reusability
interface CreateBranchModalProps {
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
  colors: ReturnType<typeof useTheme>['colors'];
}

function CreateBranchModal({
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
}: CreateBranchModalProps) {
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
          accessibilityRole="button"
          accessibilityLabel="Close modal"
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
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
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
                onSubmitEditing={onSubmit}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  { backgroundColor: colors.background },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={onClose}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Cancel branch creation"
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
  container: {
    marginBottom: SPACING.md,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    maxWidth: 160,
    minHeight: 44, // Accessibility: minimum touch target
  },
  branchName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    flexShrink: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.xs,
    minHeight: 44, // Accessibility: minimum touch target
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  addFirstBranch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.sm,
  },
  addFirstText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  // Modal styles
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
