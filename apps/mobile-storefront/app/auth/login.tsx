/**
 * Login Screen
 * OTP-based passwordless authentication
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { Logo } from '@/components/ui/Logo';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { TextContentTypes, useKeyboard } from '@/hooks/use-keyboard';
import { createLogger } from '@/lib/logger';
import { EmailSchema, getFirstError, OtpSchema } from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';

const log = createLogger('Login');

type AuthStep = 'email' | 'otp' | 'password';
type AuthMethod = 'otp' | 'password';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  /**
   * 2026 Best Practice: Intent-preserving return navigation
   * After auth, return to the screen the user originally intended to visit.
   * Falls back to dismiss (if pushed as modal) or root.
   * React Compiler handles memoization automatically.
   */
  const dismissAndNavigate = () => {
    if (returnTo) {
      router.replace(decodeURIComponent(returnTo) as '/');
    } else if (router.canDismiss()) {
      router.dismiss();
    } else {
      router.replace('/');
    }
  };

  const {
    signInWithOtp,
    verifyOtp,
    signInWithGoogle,
    isLoading,
    signInWithPassword,
    signInWithApple,
    user,
    isInitialized,
  } = useAuthStore(
    useShallow((state) => ({
      signInWithOtp: state.signInWithOtp,
      verifyOtp: state.verifyOtp,
      signInWithGoogle: state.signInWithGoogle,
      isLoading: state.isLoading,
      signInWithPassword: state.signInWithPassword,
      signInWithApple: state.signInWithApple,
      user: state.user,
      isInitialized: state.isInitialized,
    }))
  );

  const [step, setStep] = useState<AuthStep>('email');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('otp');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [_isAppleAvailable, setIsAppleAvailable] = useState(false);

  // 2026 Best Practice: Use keyboard hook for proper dismiss on submit
  const { withKeyboardDismiss } = useKeyboard();

  // Refs for input focus management
  const otpInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  // M5 fix: Guard to prevent concurrent OTP verification (auto-submit + manual tap)
  const isVerifyingRef = useRef(false);

  // Track component mount state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 2026 Best Practice: Auto-dismiss login when auth state changes.
   * Handles the case where Google/Apple OAuth redirects back to the app
   * but the handleGoogleSignIn async context was lost (app suspended/resumed).
   * The onAuthStateChange listener in auth-store sets the user correctly,
   * but this screen needs to react and navigate away.
   */
  useEffect(() => {
    if (isInitialized && user) {
      // User is authenticated — inline navigation to avoid dep on dismissAndNavigate
      if (returnTo) {
        router.replace(decodeURIComponent(returnTo) as '/');
      } else if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/');
      }
    }
  }, [isInitialized, user, returnTo]);

  // 2026 Best Practice: Dismiss keyboard on submit
  const handleContinue = withKeyboardDismiss(async () => {
    // Validate email with Zod
    const emailResult = EmailSchema.safeParse(email.trim());
    const error = getFirstError(emailResult);

    if (error) {
      setEmailError(error);
      return;
    }

    setEmailError(null);

    if (authMethod === 'otp') {
      const result = await signInWithOtp(email.toLowerCase().trim());
      if (result.success) {
        setStep('otp');
        setTimeout(() => otpInputRef.current?.focus(), 300);
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to send verification code'
        );
      }
    } else {
      setStep('password');
    }
  });

  // 2026 Best Practice: Dismiss keyboard on submit
  const handlePasswordSignIn = withKeyboardDismiss(async () => {
    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    const result = await signInWithPassword(
      email.toLowerCase().trim(),
      password
    );

    if (result.success) {
      dismissAndNavigate();
    } else {
      Alert.alert('Error', result.error || 'Failed to sign in');
    }
  });

  const handleResendOtp = async () => {
    setOtp('');
    const result = await signInWithOtp(email.toLowerCase().trim());

    if (result.success) {
      Alert.alert(
        'Success',
        'A new verification code has been sent to your email'
      );
    } else {
      Alert.alert(
        'Error',
        result.error || 'Failed to resend verification code'
      );
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('email');
      setOtp('');
    } else if (step === 'password') {
      setStep('email');
      setPassword('');
    } else {
      router.back();
    }
  };

  // 2026 Critical Fix: Handle Android hardware back button
  useEffect(() => {
    const checkAppleAvailability = async () => {
      try {
        const appleAuth = await import('expo-apple-authentication');
        const available = await appleAuth.isAvailableAsync();
        setIsAppleAvailable(available);
      } catch (_e) {
        setIsAppleAvailable(false);
      }
    };
    checkAppleAvailability();

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (step === 'otp' || step === 'password') {
          setStep('email');
          setOtp('');
          setPassword('');
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [step]);

  // 2026 Best Practice: Handle Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // 2026 Best Practice: The signInWithGoogle call now clears its own Loading state
      // in the store once the browser opens.
      const result = await signInWithGoogle();

      if (result.success) {
        log.info('Google sign-in flow initiated successfully');
        // The rest of the flow is handled by /auth/callback or the reactive useEffect watcher
      } else if (result.error !== 'Sign in was cancelled') {
        Alert.alert('Error', result.error || 'Failed to sign in with Google');
      }
    } catch (_error) {
      log.error('Unexpected error in handleGoogleSignIn:', _error);
      Alert.alert(
        'Error',
        'An unexpected error occurred during Google sign-in'
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 2026 Best Practice: Handle Apple sign-in
  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success) {
        log.info('Apple sign-in flow initiated successfully');
        // The rest of the flow is handled by the reactive useEffect watcher
      } else if (result.error !== 'Sign in was cancelled') {
        Alert.alert('Error', result.error || 'Failed to sign in with Apple');
      }
    } catch (_error) {
      log.error('Unexpected error in handleAppleSignIn:', _error);
      Alert.alert('Error', 'An unexpected error occurred during Apple sign-in');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const renderEmailStep = () => (
    <>
      <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Enter your email to receive a verification code
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Email Address
        </Text>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.muted,
              borderColor: emailError ? colors.error : colors.border,
            },
          ]}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={emailError ? colors.error : colors.textSecondary}
          />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="john@example.com"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            // 2026 Best Practice: textContentType for iOS autofill
            textContentType={TextContentTypes.emailAddress}
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            blurOnSubmit={false}
          />
        </View>
        {emailError && <Text style={[styles.errorText, { color: colors.error }]}>{emailError}</Text>}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primary },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleContinue}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
            {authMethod === 'otp'
              ? 'Continue with Code'
              : 'Continue with Password'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setAuthMethod(authMethod === 'otp' ? 'password' : 'otp')}
        style={styles.methodToggle}
      >
        <Text style={[styles.methodToggleText, { color: colors.primary }]}>
          {authMethod === 'otp'
            ? 'Use password instead'
            : 'Use verification code instead'}
        </Text>
      </Pressable>

      <View style={styles.divider}>
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
          or
        </Text>
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
      </View>

      <View style={styles.socialContainer}>
        <Pressable
          style={[
            styles.socialButton,
            { borderColor: colors.border, flex: 1 },
            (isLoading || isGoogleLoading) && styles.buttonDisabled,
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <GoogleLogo size={20} />
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Google
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.socialButton,
            { borderColor: colors.border, flex: 1 },
            (isLoading || isAppleLoading) && styles.buttonDisabled,
          ]}
          onPress={handleAppleSignIn}
          disabled={isLoading || isAppleLoading}
        >
          {isAppleLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={22} color={colors.text} />
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Apple
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={[styles.termsText, { color: colors.textSecondary }]}>
        By continuing, you agree to our{' '}
        <Text style={[styles.link, { color: colors.primary }]}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={[styles.link, { color: colors.primary }]}>
          Privacy Policy
        </Text>
      </Text>
    </>
  );

  const renderOtpStep = () => (
    <>
      <Text style={[styles.title, { color: colors.text }]}>
        Verify Your Email
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        We've sent a 6-digit verification code to{'\n'}
        <Text style={{ fontWeight: '600', color: colors.text }}>{email}</Text>
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Verification Code
        </Text>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.muted,
              borderColor: otpError ? colors.error : colors.border,
            },
          ]}
        >
          <Ionicons
            name="keypad-outline"
            size={20}
            color={otpError ? colors.error : colors.textSecondary}
          />
          <TextInput
            ref={otpInputRef}
            style={[styles.input, styles.otpInput, { color: colors.text }]}
            placeholder="000000"
            placeholderTextColor={colors.placeholder}
            value={otp}
            onChangeText={(text) => {
              setOtp(text);
              if (otpError) setOtpError(null);
              // Auto-submit when 6 digits entered
              if (text.length === 6) {
                (async () => {
                  // M5 fix: Prevent concurrent verification requests
                  if (isVerifyingRef.current) return;
                  const otpResult = OtpSchema.safeParse(text.trim());
                  if (otpResult.success) {
                    isVerifyingRef.current = true;
                    try {
                      const result = await verifyOtp(
                        email.toLowerCase().trim(),
                        text.trim()
                      );
                      // Bail out if unmounted during async operation
                      if (!isMountedRef.current) return;
                      if (result.success) {
                        dismissAndNavigate();
                      } else {
                        Alert.alert('Error', result.error || 'Invalid code');
                      }
                    } finally {
                      isVerifyingRef.current = false;
                    }
                  }
                })();
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
            textContentType={TextContentTypes.oneTimeCode}
            autoComplete="one-time-code"
            returnKeyType="done"
          />
        </View>
        {otpError && <Text style={[styles.errorText, { color: colors.error }]}>{otpError}</Text>}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primary },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={async () => {
          // M5 fix: Prevent concurrent verification requests
          if (isVerifyingRef.current) return;
          const otpResult = OtpSchema.safeParse(otp.trim());
          const error = getFirstError(otpResult);
          if (error) {
            setOtpError(error);
            return;
          }
          setOtpError(null);
          isVerifyingRef.current = true;
          try {
            const result = await verifyOtp(
              email.toLowerCase().trim(),
              otp.trim()
            );
            if (result.success) {
              dismissAndNavigate();
            } else {
              Alert.alert('Error', result.error || 'Invalid code');
            }
          } finally {
            isVerifyingRef.current = false;
          }
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Verify</Text>
        )}
      </Pressable>

      <View style={styles.resendContainer}>
        <Text style={[styles.resendText, { color: colors.textSecondary }]}>
          Didn't receive the code?
        </Text>
        <Pressable onPress={handleResendOtp} disabled={isLoading}>
          <Text style={[styles.resendLink, { color: colors.primary }]}>
            Resend
          </Text>
        </Pressable>
      </View>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={[styles.title, { color: colors.text }]}>Enter Password</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Sign in with your password for {email}
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Password
        </Text>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.muted,
              borderColor: passwordError ? colors.error : colors.border,
            },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={passwordError ? colors.error : colors.textSecondary}
          />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            textContentType={TextContentTypes.password}
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handlePasswordSignIn}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        {passwordError && <Text style={[styles.errorText, { color: colors.error }]}>{passwordError}</Text>}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primary },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handlePasswordSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Sign In</Text>
        )}
      </Pressable>

      <Pressable
        onPress={async () => {
          setAuthMethod('otp');
          // Validate email inline instead of calling handleContinue,
          // which would read the stale authMethod ('password') from closure.
          const emailResult = EmailSchema.safeParse(email.trim());
          const error = getFirstError(emailResult);
          if (error) {
            setEmailError(error);
            setStep('email');
            return;
          }
          setEmailError(null);
          const result = await signInWithOtp(email.toLowerCase().trim());
          if (result.success) {
            setStep('otp');
            setTimeout(() => otpInputRef.current?.focus(), 300);
          } else {
            setStep('email');
            Alert.alert(
              'Error',
              result.error || 'Failed to send verification code'
            );
          }
        }}
        style={styles.methodToggle}
      >
        <Text style={[styles.methodToggleText, { color: colors.primary }]}>
          Sign in with verification code instead
        </Text>
      </Pressable>
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.logoContainer}>
              <Logo
                color={colorScheme === 'dark' ? 'white' : 'black'}
                width={180}
                height={32}
              />
            </View>

            {step === 'email'
              ? renderEmailStep()
              : step === 'otp'
                ? renderOtpStep()
                : renderPasswordStep()}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    padding: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  methodToggle: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 8,
  },
  methodToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    fontWeight: '500',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
});
