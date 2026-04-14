import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useInviteStaff } from '@/hooks/useStaff';
import { useTheme } from '@/hooks/useTheme';
import type { StaffRole } from '@/lib/types/staff';

const DEFAULT_INVITE_ROLE: StaffRole = 'sales_rep';
const TOGGLE_KNOB_TRAVEL = 20;

interface StaffInviteSheetProps {
  onClose: () => void;
  visible: boolean;
}

export function StaffInviteSheet({ onClose, visible }: StaffInviteSheetProps) {
  const { colors } = useTheme();
  const inviteStaff = useInviteStaff();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [autoCreateAccount, setAutoCreateAccount] = useState(true);
  const toggleTranslateX = useRef(
    new Animated.Value(autoCreateAccount ? TOGGLE_KNOB_TRAVEL : 0)
  ).current;
  const isInviteDisabled =
    inviteStaff.isPending || inviteEmail.trim().length === 0;

  useEffect(() => {
    Animated.spring(toggleTranslateX, {
      damping: 16,
      mass: 0.9,
      stiffness: 220,
      toValue: autoCreateAccount ? TOGGLE_KNOB_TRAVEL : 0,
      useNativeDriver: true,
    }).start();
  }, [autoCreateAccount, toggleTranslateX]);

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteName('');
    setAutoCreateAccount(true);
  };

  const handleInvite = async () => {
    const normalizedEmail = inviteEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await inviteStaff.mutateAsync({
        email: normalizedEmail,
        name: inviteName.trim() || undefined,
        role: DEFAULT_INVITE_ROLE,
        autoCreateAccount,
      });

      onClose();
      resetInviteForm();

      const emailDeliveryFailed = result?.emailDelivery?.status === 'failed';

      if (result?.inviteUrl) {
        Alert.alert(
          emailDeliveryFailed ? 'Invite Link Ready' : 'Invitation Sent',
          emailDeliveryFailed
            ? `We couldn't deliver the invite email to ${normalizedEmail}. Share the link directly to finish setup.`
            : `The invite email was sent to ${normalizedEmail}. Share the link directly if they don't receive it.`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Share Link',
              onPress: async () => {
                try {
                  await Share.share({
                    message: `You've been invited to join the team! Accept here: ${result.inviteUrl}`,
                    url: result.inviteUrl,
                  });
                } catch (error) {
                  console.error('Failed to open invite share sheet:', error);
                  Alert.alert(
                    'Error',
                    'Unable to open the share sheet right now.'
                  );
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        emailDeliveryFailed ? 'Invite Created' : 'Success',
        emailDeliveryFailed
          ? 'The invitation was created, but the email could not be delivered.'
          : 'Invitation sent successfully'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send invitation'
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <KeyboardAwareModalContainer
          align="end"
          contentContainerStyle={styles.modalKeyboardContent}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Invite Team Member
              </Text>
              <Pressable
                accessibilityLabel="Close invite team member sheet"
                accessibilityRole="button"
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Email *
              </Text>
              <TextInput
                accessibilityLabel="Invite email"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="staff@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                importantForAutofill="yes"
                textContentType="emailAddress"
                value={inviteEmail}
                onChangeText={setInviteEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Name (optional)
              </Text>
              <TextInput
                accessibilityLabel="Invite name"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoComplete="name"
                importantForAutofill="yes"
                textContentType="name"
                value={inviteName}
                onChangeText={setInviteName}
              />
            </View>

            <Pressable
              style={styles.toggleRow}
              onPress={() => setAutoCreateAccount((current) => !current)}
              accessibilityRole="togglebutton"
              accessibilityState={{ checked: autoCreateAccount }}
              accessibilityLabel="Generate staff account"
              accessibilityHint="Automatically create a NUBAN for this staff member"
            >
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  Generate Staff Account
                </Text>
                <Text
                  style={[styles.toggleDesc, { color: colors.textSecondary }]}
                >
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
                <Animated.View
                  style={[
                    styles.toggleKnob,
                    {
                      backgroundColor: colors.textOnPrimary,
                      transform: [{ translateX: toggleTranslateX }],
                    },
                  ]}
                />
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.inviteButton,
                { backgroundColor: colors.primary },
                isInviteDisabled && styles.inviteButtonDisabled,
              ]}
              onPress={handleInvite}
              accessibilityLabel="Send invitation"
              accessibilityRole="button"
              accessibilityState={{ disabled: isInviteDisabled }}
              disabled={isInviteDisabled}
            >
              {inviteStaff.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="mail"
                    size={18}
                    color={colors.textOnPrimary}
                  />
                  <Text
                    style={[
                      styles.inviteButtonText,
                      { color: colors.textOnPrimary },
                    ]}
                  >
                    Send Invitation
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAwareModalContainer>
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
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  inputGroup: {
    marginBottom: SPACING.lg,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  toggleLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  toggleDesc: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
