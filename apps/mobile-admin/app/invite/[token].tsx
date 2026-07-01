import Ionicons from '@react-native-vector-icons/ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  clearPendingStaffInviteToken,
  normalizeStaffInviteToken,
  savePendingStaffInviteToken,
} from '@/lib/staff-invite-pending';
import { supabase } from '@/lib/supabase';

interface InvitePreview {
  email: string;
  merchant_business_name: string | null;
  merchant_slug?: string | null;
  role: string;
}

type InviteState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string; title: string }
  | { status: 'success'; message: string; title: string };

function getFirstPreviewRow(rows: unknown): InvitePreview | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0] as Partial<InvitePreview>;

  if (typeof row.email !== 'string' || typeof row.role !== 'string') {
    return null;
  }

  return {
    email: row.email,
    merchant_business_name:
      typeof row.merchant_business_name === 'string'
        ? row.merchant_business_name
        : null,
    merchant_slug:
      typeof row.merchant_slug === 'string' ? row.merchant_slug : null,
    role: row.role,
  };
}

function getAcceptErrorMessage(message: string): string {
  if (message === 'invite_expired') {
    return 'This invitation has expired. Ask the store owner to send a new one.';
  }

  if (message === 'invite_used') {
    return 'This invitation has already been accepted.';
  }

  if (message === 'email_mismatch') {
    return 'This invitation belongs to a different email address.';
  }

  if (message === 'already_owner') {
    return 'You already own this store.';
  }

  if (message === 'already_staff') {
    return 'You are already a staff member of this store.';
  }

  return 'We could not accept this invitation. Please try again.';
}

export default function StaffInviteScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const token = normalizeStaffInviteToken(tokenParam);
  const [inviteState, setInviteState] = useState<InviteState>({
    status: 'loading',
    message: 'Checking your invitation...',
  });

  useEffect(() => {
    let cancelled = false;

    async function acceptInvite() {
      if (!token) {
        setInviteState({
          status: 'error',
          title: 'Invalid Link',
          message: 'This staff invitation link is missing its token.',
        });
        return;
      }

      if (isLoading) {
        return;
      }

      if (!isAuthenticated) {
        savePendingStaffInviteToken(token);
        router.replace('/(auth)/login');
        return;
      }

      if (!user?.email) {
        setInviteState({
          status: 'error',
          title: 'Email Required',
          message: 'Your account needs an email address to accept this invite.',
        });
        return;
      }

      setInviteState({
        status: 'loading',
        message: 'Accepting your invitation...',
      });

      const { data: previewRows, error: previewError } = await supabase.rpc(
        'get_staff_invite_preview',
        { p_token: token }
      );

      if (cancelled) {
        return;
      }

      const invitation = getFirstPreviewRow(previewRows);
      if (previewError || !invitation) {
        clearPendingStaffInviteToken();
        setInviteState({
          status: 'error',
          title: 'Invalid Invitation',
          message:
            'This invitation is invalid, expired, or has already been used.',
        });
        return;
      }

      if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
        setInviteState({
          status: 'error',
          title: 'Wrong Account',
          message: `This invite was sent to ${invitation.email}. Sign in with that email to accept it.`,
        });
        return;
      }

      const { error: acceptError } = await supabase.rpc('accept_staff_invite', {
        p_token: token,
        p_email: user.email,
      });

      if (cancelled) {
        return;
      }

      if (acceptError) {
        clearPendingStaffInviteToken();
        setInviteState({
          status: 'error',
          title: 'Invite Not Accepted',
          message: getAcceptErrorMessage(acceptError.message),
        });
        return;
      }

      clearPendingStaffInviteToken();
      setInviteState({
        status: 'success',
        title: 'Invitation Accepted',
        message: `You have joined ${
          invitation.merchant_business_name ||
          invitation.merchant_slug ||
          'this store'
        }.`,
      });
      router.replace('/(admin)/(tabs)');
    }

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, router, token, user?.email]);

  const isError = inviteState.status === 'error';
  const isSuccess = inviteState.status === 'success';
  const iconName = isError
    ? 'alert-circle-outline'
    : isSuccess
      ? 'checkmark-circle-outline'
      : 'mail-open-outline';
  const iconColor = isError
    ? colors.error
    : isSuccess
      ? colors.success
      : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Ionicons name={iconName} size={42} color={iconColor} />
        <Text style={[styles.title, { color: colors.text }]}>
          {inviteState.status === 'loading'
            ? 'Staff Invitation'
            : inviteState.title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {inviteState.message}
        </Text>
        {inviteState.status === 'loading' ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : null}
        {isError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
            onPress={() => {
              clearPendingStaffInviteToken();
              router.replace('/(auth)/login');
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
              Sign In
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  card: {
    alignItems: 'center',
    borderRadius: 20,
    gap: SPACING.md,
    maxWidth: 420,
    padding: SPACING['2xl'],
    width: '100%',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  message: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    textAlign: 'center',
  },
});
