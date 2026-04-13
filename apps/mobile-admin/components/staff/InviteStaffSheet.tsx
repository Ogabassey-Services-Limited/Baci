import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface InviteStaffSheetProps {
  autoCreateAccount: boolean;
  colors: ThemeColors;
  inviteEmail: string;
  inviteName: string;
  isPending: boolean;
  onClose: () => void;
  onEmailChange: (text: string) => void;
  onNameChange: (text: string) => void;
  onSubmit: () => void;
  onToggleAutoCreateAccount: () => void;
  visible: boolean;
}

export function InviteStaffSheet({
  autoCreateAccount,
  colors,
  inviteEmail,
  inviteName,
  isPending,
  onClose,
  onEmailChange,
  onNameChange,
  onSubmit,
  onToggleAutoCreateAccount,
  visible,
}: InviteStaffSheetProps) {
  const isInviteDisabled = isPending || inviteEmail.trim().length === 0;

  return (
    <AppSheetModal
      accessibilityLabel="Invite team member"
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: colors.card }]}
      visible={visible}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Invite Team Member
        </Text>
        <Pressable
          accessibilityLabel="Close invite team member sheet"
          accessibilityRole="button"
          onPress={onClose}
        >
          <Ionicons color={colors.textMuted} name="close" size={24} />
        </Pressable>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Email *
        </Text>
        <TextInput
          accessibilityLabel="Invite email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={onEmailChange}
          placeholder="staff@example.com"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={inviteEmail}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Name (optional)
        </Text>
        <TextInput
          accessibilityLabel="Invite name"
          onChangeText={onNameChange}
          placeholder="John Doe"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={inviteName}
        />
      </View>

      <Pressable
        accessibilityHint="Automatically create a NUBAN for this staff member"
        accessibilityLabel="Generate staff account"
        accessibilityRole="togglebutton"
        accessibilityState={{ checked: autoCreateAccount }}
        onPress={onToggleAutoCreateAccount}
        style={styles.toggleRow}
      >
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Generate Staff Account
          </Text>
          <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
            Automatically create a NUBAN for this staff member
          </Text>
        </View>
        <View
          style={[
            styles.toggleSwitch,
            {
              backgroundColor: autoCreateAccount
                ? colors.success
                : colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              {
                backgroundColor: colors.textOnPrimary,
                transform: [{ translateX: autoCreateAccount ? 20 : 0 }],
              },
            ]}
          />
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel="Send invitation"
        accessibilityRole="button"
        accessibilityState={{ disabled: isInviteDisabled }}
        disabled={isInviteDisabled}
        onPress={onSubmit}
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary },
          isInviteDisabled && styles.submitButtonDisabled,
        ]}
      >
        {isPending ? (
          <ActivityIndicator color={colors.textOnPrimary} size="small" />
        ) : (
          <>
            <Ionicons color={colors.textOnPrimary} name="mail" size={18} />
            <Text
              style={[styles.submitButtonText, { color: colors.textOnPrimary }]}
            >
              Send Invitation
            </Text>
          </>
        )}
      </Pressable>
    </AppSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  toggleInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  toggleLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  toggleDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  toggleSwitch: {
    borderRadius: 12,
    height: 24,
    padding: 2,
    width: 44,
  },
  toggleKnob: {
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING.md,
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
