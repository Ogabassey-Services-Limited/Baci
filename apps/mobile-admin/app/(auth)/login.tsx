/**
 * Login Screen - Mobile Admin
 * Clean, minimal design with Google and Apple sign-in support
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { getEmailError } from '@/lib/sanitize';

// Multi-colored Google Logo Component
const GoogleLogo = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);

import { BaciLogo } from '@/components/BaciLogo';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

// Baci Brand Colors
const BRAND = {
  yellow: '#f0bf58',
  navy: '#23255d',
};

export default function LoginScreen() {
  // 2026 Best Practice: Destructure for React Compiler stable refs
  const { push, replace } = useRouter();
  const { colors } = useTheme();
  const {
    activeAuthProvider,
    isAuthenticating,
    signIn,
    signInWithApple,
    signInWithGoogle,
  } = useAuth();
  const { resetOnboarding } = useOnboarding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleGoogleSignIn = async () => {
    setError(null);

    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);

    const result = await signInWithApple();
    if (result.error) {
      setError(result.error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    // Validate email format using Zod schema
    const emailError = getEmailError(email.trim());
    if (emailError) {
      setError(emailError);
      return;
    }

    setError(null);

    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(
        result.error === 'Invalid login credentials'
          ? 'Incorrect email or password'
          : result.error
      );
    }
  };

  const isPasswordLoading =
    isAuthenticating && activeAuthProvider === 'password';
  const isGoogleLoading = isAuthenticating && activeAuthProvider === 'google';
  const isAppleLoading = isAuthenticating && activeAuthProvider === 'apple';
  const isAnyLoading = isAuthenticating;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <SystemBars style="auto" />
      <AppKeyboardContainer
        align="center"
        contentContainerStyle={styles.content}
        style={styles.contentContainer}
      >
        <View>
          {/* Baci Branding */}
          <View style={styles.header}>
            <BaciLogo size={80} borderRadius={20} />
            <Text style={[styles.title, { color: BRAND.navy }]}>Baci</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Manage your store on the go
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error ? (
              <View
                style={[
                  styles.errorCard,
                  { backgroundColor: colors.errorLight },
                ]}
              >
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Email
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={!isAnyLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  editable={!isAnyLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => {
                if (isAnyLoading) {
                  return;
                }

                push('/(auth)/forgot-password');
              }}
              style={styles.forgotPassword}
              disabled={isAnyLoading}
              accessibilityRole="link"
              accessibilityLabel="Forgot password? Reset your password"
              accessibilityState={{ disabled: isAnyLoading }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            <Pressable
              style={[
                styles.loginButton,
                { backgroundColor: BRAND.yellow },
                isAnyLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isAnyLoading}
              accessibilityRole="button"
              accessibilityLabel={
                isPasswordLoading ? 'Signing in' : 'Sign in to your account'
              }
              accessibilityState={{ disabled: isAnyLoading }}
            >
              {isPasswordLoading ? (
                <ActivityIndicator color={BRAND.navy} />
              ) : (
                <Text style={[styles.loginButtonText, { color: BRAND.navy }]}>
                  Sign In
                </Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                or continue with
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialButtons}>
              {/* Google Sign-In */}
              <Pressable
                style={[
                  styles.socialButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={handleGoogleSignIn}
                disabled={isAnyLoading}
                accessibilityRole="button"
                accessibilityLabel={
                  isGoogleLoading
                    ? 'Signing in with Google'
                    : 'Sign in with Google'
                }
                accessibilityState={{ disabled: isAnyLoading }}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <GoogleLogo size={20} />
                    <Text
                      style={[styles.socialButtonText, { color: colors.text }]}
                    >
                      Google
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Apple Sign-In (iOS only) */}
              {Platform.OS === 'ios' && (
                <Pressable
                  style={[
                    styles.socialButton,
                    { backgroundColor: '#000', borderColor: '#000' },
                  ]}
                  onPress={handleAppleSignIn}
                  disabled={isAnyLoading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAppleLoading
                      ? 'Signing in with Apple'
                      : 'Sign in with Apple'
                  }
                  accessibilityState={{ disabled: isAnyLoading }}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#FFF" />
                      <Text
                        style={[styles.socialButtonText, { color: '#FFF' }]}
                      >
                        Apple
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: colors.textMuted }]}>
              Don&apos;t have an account?
            </Text>
            <Pressable
              onPress={() => push('/(auth)/register')}
              disabled={isAnyLoading}
              accessibilityRole="link"
              accessibilityLabel="Sign up for a new merchant account"
              accessibilityState={{ disabled: isAnyLoading }}
            >
              <Text
                style={[
                  styles.signUpLink,
                  isAnyLoading && styles.signUpLinkDisabled,
                ]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* DEV: Reset Onboarding */}
          {__DEV__ && (
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                gap: 8,
                marginTop: SPACING.xl,
                backgroundColor: '#FEF3C7',
                borderColor: '#F59E0B',
              }}
              onPress={async () => {
                await resetOnboarding();
                Alert.alert(
                  'Onboarding Reset',
                  'You will now be taken to the onboarding screen.',
                  [
                    {
                      text: 'OK',
                      onPress: () => replace('/(auth)/onboarding'),
                    },
                  ]
                );
              }}
            >
              <Ionicons name="refresh-outline" size={20} color="#D97706" />
              <Text style={{ color: '#D97706', fontWeight: '600' }}>
                Reset Onboarding (Dev)
              </Text>
            </Pressable>
          )}
        </View>
      </AppKeyboardContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING['3xl'],
  },
  title: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  form: {
    gap: SPACING.lg,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginLeft: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  eyeButton: {
    padding: SPACING.xs,
  },
  loginButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: SPACING.sm,
  },
  forgotPasswordText: {
    color: BRAND.yellow,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING['3xl'],
    gap: SPACING.xs,
  },
  signUpText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  signUpLink: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    color: BRAND.yellow,
  },
  signUpLinkDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: SPACING.sm,
  },
  socialButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
