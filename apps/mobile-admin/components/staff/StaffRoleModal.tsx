import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type StaffRole,
  VALID_ROLES,
} from '@/lib/types/staff';

interface StaffRoleModalProps {
  isPending: boolean;
  onClose: () => void;
  onSelectRole: (role: StaffRole) => void;
  onSubmit: () => void;
  selectedRole: StaffRole;
  visible: boolean;
}

export function StaffRoleModal({
  isPending,
  onClose,
  onSelectRole,
  onSubmit,
  selectedRole,
  visible,
}: StaffRoleModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      <View style={styles.modalOverlay}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Change Role
            </Text>
            <Pressable
              accessibilityHint="Closes the role selection sheet"
              accessibilityLabel="Close"
              accessibilityRole="button"
              accessible
              hitSlop={12}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.roleList}>
            {VALID_ROLES.map((role) => (
              <Pressable
                key={role}
                accessibilityLabel={`Role ${ROLE_LABELS[role]}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedRole === role }}
                style={[
                  styles.roleListItem,
                  selectedRole === role && {
                    backgroundColor:
                      colors.primaryLight ??
                      colors.cardHover ??
                      colors.background,
                  },
                ]}
                onPress={() => onSelectRole(role)}
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
                {selectedRole === role ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessibilityLabel="Update staff role"
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending }}
            accessible
            style={[
              styles.actionButton,
              { backgroundColor: colors.primary },
              isPending && styles.actionButtonDisabled,
            ]}
            disabled={isPending}
            onPress={onSubmit}
          >
            <Text
              style={[styles.actionButtonText, { color: colors.textOnPrimary }]}
            >
              {isPending ? 'Updating...' : 'Update Role'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  roleList: {
    maxHeight: 300,
  },
  roleListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  roleListLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  roleListDesc: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.xs / 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
