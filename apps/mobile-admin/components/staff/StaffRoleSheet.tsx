import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type StaffRole,
  VALID_ROLES,
} from '@/lib/types/staff';

interface StaffRoleSheetProps {
  colors: ThemeColors;
  isPending: boolean;
  onClose: () => void;
  onRoleSelect: (role: StaffRole) => void;
  onSubmit: () => void;
  selectedRole: StaffRole;
  visible: boolean;
}

export function StaffRoleSheet({
  colors,
  isPending,
  onClose,
  onRoleSelect,
  onSubmit,
  selectedRole,
  visible,
}: StaffRoleSheetProps) {
  const footer = (
    <Pressable
      accessibilityLabel="Update role"
      accessibilityRole="button"
      accessibilityState={{ disabled: isPending }}
      disabled={isPending}
      onPress={onSubmit}
      style={[
        styles.submitButton,
        { backgroundColor: colors.primary },
        isPending && styles.submitButtonDisabled,
      ]}
    >
      <Text style={[styles.submitButtonText, { color: colors.textOnPrimary }]}>
        {isPending ? 'Updating...' : 'Update Role'}
      </Text>
    </Pressable>
  );

  return (
    <AppPageSheet
      closeLabel="Close role change sheet"
      footer={footer}
      onClose={onClose}
      title="Change Role"
      visible={visible}
    >
      <ScrollView style={styles.roleList}>
        {VALID_ROLES.map((role) => {
          const isSelected = selectedRole === role;
          return (
            <Pressable
              accessibilityLabel={`Select ${ROLE_LABELS[role]}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={role}
              onPress={() => onRoleSelect(role)}
              style={[
                styles.roleListItem,
                isSelected && {
                  backgroundColor:
                    colors.primaryLight ??
                    colors.cardHover ??
                    colors.background,
                },
              ]}
            >
              <View>
                <Text style={[styles.roleListLabel, { color: colors.text }]}>
                  {ROLE_LABELS[role]}
                </Text>
                <Text
                  style={[styles.roleListDesc, { color: colors.textMuted }]}
                >
                  {ROLE_DESCRIPTIONS[role]}
                </Text>
              </View>
              {isSelected ? (
                <Text style={[styles.selectedBadge, { color: colors.primary }]}>
                  Selected
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  roleList: {
    maxHeight: 320,
  },
  roleListItem: {
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  roleListLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  roleListDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  selectedBadge: {
    alignSelf: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
