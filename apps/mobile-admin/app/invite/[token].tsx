import Ionicons from '@react-native-vector-icons/ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  getAcceptErrorMessage,
  getFirstPreviewRow,
  type InviteErrorAction,
  type InviteState,
  TERMINAL_ACCEPT_ERRORS,
} from '@/lib/staff-invite';
import {
  clearPendingStaffInviteToken,
  normalizeStaffInviteToken,
  savePendingStaffInviteToken,
} from '@/lib/staff-invite-pending';
import { staffInviteStyles as styles } from '@/lib/staff-invite-styles';
import { supabase } from '@/lib/supabase';

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
        // Send unauthenticated invitees to the account-only staff signup (which
        // offers a "Sign in" link for existing accounts). Merchant registration
        // must NOT be the invite on-ramp: it creates an owner store, and the
        // merchant-context RPC prefers owner over staff, so the invitee would
        // be pinned to their own empty store instead of the invited one.
        savePendingStaffInviteToken(token);
        router.replace('/(auth)/staff-signup');
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

    // Terminal dismiss: the token is already cleared. Send an already
    // signed-in user back to the dashboard (the auth layout would otherwise
    // just bounce them there from /login); send a signed-out user to login.
    clearPendingStaffInviteToken();
    router.replace(isAuthenticated ? '/(admin)/(tabs)' : '/(auth)/login');
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
  const dismissLabel = isAuthenticated ? 'Go to Dashboard' : 'Sign In';
  const dismissAccessibilityLabel = isAuthenticated
    ? 'Go to dashboard'
    : 'Go to sign in';
  const errorButtonLabel =
    errorAction === 'retry'
      ? 'Try Again'
      : errorAction === 'switch_account'
        ? 'Sign in with a different account'
        : dismissLabel;
  const errorButtonAccessibilityLabel =
    errorAction === 'retry'
      ? 'Try again'
      : errorAction === 'switch_account'
        ? 'Sign out and sign in with a different account'
        : dismissAccessibilityLabel;

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
