import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  Text,
  type TextInput,
  View,
} from 'react-native';
import { AuthInput } from '@/components/auth/AuthInput';
import { styles } from '@/components/auth/login.styles';
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle';
import { BaciLogo } from '@/components/BaciLogo';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { validatePassword } from '@/lib/password-utils';
import { getEmailError } from '@/lib/sanitize';
import { getFirstPreviewRow } from '@/lib/staff-invite';
import {
  buildStaffInviteRoute,
  getPendingStaffInviteToken,
} from '@/lib/staff-invite-pending';
import { supabase } from '@/lib/supabase';

type InviteStatus = 'loading' | 'valid' | 'invalid';

/**
 * Account-only signup for staff invitees. Creates just an auth user (no
 * merchant) so get_user_merchant_context's staff fallback resolves the invited
 * store instead of pinning the user to a store of their own. Reached from the
 * invite screen when the visitor is not signed in. Signup is gated on a
 * verified invite preview so a bogus/expired token can't create orphan
 * accounts, and the email is locked to the invited address.
 */
export default function StaffSignupScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { signUp, isAuthenticating } = useAuth();
  const token = getPendingStaffInviteToken();

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>(
    token ? 'loading' : 'invalid'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Verify the invite and lock the email to the invited address. Only a
  // confirmed, still-valid invitation enables account creation.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setInviteStatus('invalid');
      return;
    }
    supabase
      .rpc('get_staff_invite_preview', { p_token: token })
      .then(({ data, error: previewError }) => {
        if (cancelled) {
          return;
        }
        const invitation = getFirstPreviewRow(data);
        if (previewError || !invitation?.email) {
          setInviteStatus('invalid');
          return;
        }
        setEmail(invitation.email);
        setInviteStatus('valid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isLoading = isAuthenticating;
  const canSubmit = inviteStatus === 'valid' && !isLoading;
  const bannerError =
    error ??
    (inviteStatus === 'invalid'
      ? 'This invitation is invalid or has expired. Ask the store owner to send a new one.'
      : null);

  const handleSubmit = async () => {
    setError(null);

    if (!token || inviteStatus !== 'valid') {
      setError('This invitation is invalid or has expired.');
      return;
    }

    const emailError = getEmailError(email.trim());
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordResult = validatePassword(password, confirmPassword);
    if (!passwordResult.isValid) {
      setError(passwordResult.error ?? 'Please choose a stronger password.');
      return;
    }

    const result = await signUp({ email: email.trim(), password });

    if (result.accountExists) {
      Alert.alert(
        'Account Already Exists',
        'You already have an account. Sign in to accept your invitation.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    if (result.needsEmailConfirmation) {
      Alert.alert(
        'Confirm Your Email',
        'Check your inbox to confirm your email, then sign in to accept your invitation.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    // Session established — the account owns no merchant, so accepting the
    // invite will resolve the invited store.
    router.replace(buildStaffInviteRoute(token));
  };

  return (
    <AppFormScreen
      contentContainerStyle={styles.content}
      scrollEnabled={false}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <BaciLogo size={80} borderRadius={20} />
          <Text style={[styles.title, { color: colors.text }]}>
            Join the team
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Create your account to accept the invitation
          </Text>
        </View>

        <View style={styles.form}>
          {bannerError ? (
            <View
              style={[styles.errorCard, { backgroundColor: colors.errorLight }]}
            >
              <Text style={[styles.errorText, { color: colors.error }]}>
                {bannerError}
              </Text>
            </View>
          ) : null}

          <AuthInput
            autoCapitalize="none"
            autoComplete="email"
            blurOnSubmit={false}
            borderColor={colors.border}
            editable={false}
            iconColor={colors.textMuted}
            iconName="mail-outline"
            keyboardType="email-address"
            label="Email"
            labelColor={colors.textSecondary}
            onChangeText={setEmail}
            placeholder={
              inviteStatus === 'loading' ? 'Checking invitation…' : ''
            }
            placeholderTextColor={colors.textMuted}
            textColor={colors.text}
            textContentType="emailAddress"
            value={email}
            wrapperColor={colors.card}
          />

          <AuthInput
            autoComplete="password-new"
            borderColor={colors.border}
            editable={canSubmit}
            iconColor={colors.textMuted}
            iconName="lock-closed-outline"
            inputRef={passwordRef}
            label="Password"
            labelColor={colors.textSecondary}
            onChangeText={setPassword}
            onSubmitEditing={() => confirmRef.current?.focus()}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            rightAccessory={
              <PasswordVisibilityToggle
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
                iconColor={colors.textMuted}
                iconName={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword((prev) => !prev)}
              />
            }
            secureTextEntry={!showPassword}
            textColor={colors.text}
            textContentType="newPassword"
            value={password}
            wrapperColor={colors.card}
          />

          <AuthInput
            autoComplete="password-new"
            borderColor={colors.border}
            editable={canSubmit}
            iconColor={colors.textMuted}
            iconName="lock-closed-outline"
            inputRef={confirmRef}
            label="Confirm password"
            labelColor={colors.textSecondary}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSubmit}
            placeholder="Re-enter your password"
            placeholderTextColor={colors.textMuted}
            returnKeyType="go"
            secureTextEntry={!showPassword}
            textColor={colors.text}
            textContentType="newPassword"
            value={confirmPassword}
            wrapperColor={colors.card}
          />

          <Pressable
            accessibilityLabel="Create account and accept invitation"
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={[
              styles.loginButton,
              { backgroundColor: colors.primary },
              !canSubmit && styles.loginButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text
                style={[styles.loginButtonText, { color: colors.textOnPrimary }]}
              >
                Create account & join
              </Text>
            )}
          </Pressable>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable
              accessibilityLabel="Sign in instead"
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={[styles.signUpLink, { color: colors.primary }]}>
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AppFormScreen>
  );
}
