import Ionicons from '@react-native-vector-icons/ionicons';
import { useQueryClient } from '@tanstack/react-query';
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

// What the error screen's primary button should do.
//  - 'retry': transient failure (network/unknown). Keep the pending token and
//    let the user re-run the flow.
//  - 'switch_account': signed in as the wrong account. Preserve the token, sign
//    out, and send them to login so re-authenticating resumes the invite.
//  - 'dismiss': terminal failure (invalid/used/expired). Token already cleared.
type InviteErrorAction = 'retry' | 'switch_account' | 'dismiss';

type InviteState =
  | { status: 'loading'; message: string }
  | {
      status: 'error';
      message: string;
      title: string;
      action: InviteErrorAction;
    }
  | { status: 'success'; message: string; title: string };

// Terminal acceptance errors raised by accept_staff_invite. Anything else
// (network blips, unexpected server errors) is treated as retryable so a valid
// invite is never discarded on a transient failure.
const TERMINAL_ACCEPT_ERRORS = new Set([
  'invite_expired',
  'invite_used',
  'email_mismatch',
  'already_owner',
  'already_staff',
]);

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
  const { isAuthenticated, isLoading, signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const token = normalizeStaffInviteToken(tokenParam);
  const userId = user?.id;
  const [retryNonce, setRetryNonce] = useState(0);
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
          action: 'dismiss',
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
          action: 'dismiss',
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

      // A preview RPC error may be a transient network/service failure — keep
      // the pending token so the user can retry once connectivity recovers.
      if (previewError) {
        setInviteState({
          status: 'error',
          title: 'Connection Problem',
          message:
            'We could not reach the server to check this invitation. Please try again.',
          action: 'retry',
        });
        return;
      }

      // No error but no invitation row means the backend confirmed the token is
      // terminally invalid/used/expired — only now is it safe to clear it.
      const invitation = getFirstPreviewRow(previewRows);
      if (!invitation) {
        clearPendingStaffInviteToken();
        setInviteState({
          status: 'error',
          title: 'Invalid Invitation',
          message:
            'This invitation is invalid, expired, or has already been used.',
          action: 'dismiss',
        });
        return;
      }

      if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
        // Keep the token so re-authenticating with the invited email resumes
        // acceptance automatically (handled by the auth layout redirect).
        savePendingStaffInviteToken(token);
        setInviteState({
          status: 'error',
          title: 'Wrong Account',
          message: `This invite was sent to ${invitation.email}. Sign out and sign in with that email to accept it.`,
          action: 'switch_account',
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
        const isTerminal = TERMINAL_ACCEPT_ERRORS.has(acceptError.message);
        // Only discard the invite on a terminal error; transient failures stay
        // retryable so a still-valid invite is not lost.
        if (isTerminal) {
          clearPendingStaffInviteToken();
        }
        setInviteState({
          status: 'error',
          title: 'Invite Not Accepted',
          message: getAcceptErrorMessage(acceptError.message),
          action: isTerminal ? 'dismiss' : 'retry',
        });
        return;
      }

      clearPendingStaffInviteToken();

      // The merchant context may have been cached as "no merchant" before the
      // invite was accepted. Refetch it so the admin tabs load the new store
      // instead of a stale empty state.
      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: ['merchant', userId],
        });
      }

      if (cancelled) {
        return;
      }

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
  }, [
    isAuthenticated,
    isLoading,
    queryClient,
    retryNonce,
    router,
    token,
    user?.email,
    userId,
  ]);

  async function handleErrorAction(action: InviteErrorAction) {
    if (action === 'retry') {
      setInviteState({
        status: 'loading',
        message: 'Checking your invitation...',
      });
      setRetryNonce((value) => value + 1);
      return;
    }

    if (action === 'switch_account') {
      if (token) {
        savePendingStaffInviteToken(token);
      }
      await signOut();
      router.replace('/(auth)/login');
      return;
    }

    clearPendingStaffInviteToken();
    router.replace('/(auth)/login');
  }

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

  const errorAction = isError ? inviteState.action : null;
  const errorButtonLabel =
    errorAction === 'retry'
      ? 'Try Again'
      : errorAction === 'switch_account'
        ? 'Sign in with a different account'
        : 'Sign In';
  const errorButtonAccessibilityLabel =
    errorAction === 'retry'
      ? 'Try again'
      : errorAction === 'switch_account'
        ? 'Sign out and sign in with a different account'
        : 'Go to sign in';

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
        {isError && errorAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={errorButtonAccessibilityLabel}
            onPress={() => {
              void handleErrorAction(errorAction);
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
              {errorButtonLabel}
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
