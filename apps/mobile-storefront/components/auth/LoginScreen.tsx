import Ionicons from "@react-native-vector-icons/ionicons";
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LoginEmailStep,
  type LoginAuthMethod,
} from '@/components/auth/LoginEmailStep';
import { loginStepStyles } from '@/components/auth/LoginStep.styles';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
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

export function LoginScreen() {
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
  const [authMethod, setAuthMethod] = useState<LoginAuthMethod>('otp');
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

  const renderOtpStep = () => (
    <>
      <Text style={[loginStepStyles.title, { color: colors.text }]}>
        Verify Your Email
      </Text>
      <Text style={[loginStepStyles.subtitle, { color: colors.textSecondary }]}>
        We've sent a 6-digit verification code to{'\n'}
        <Text style={{ fontWeight: '600', color: colors.text }}>{email}</Text>
      </Text>

      <View style={loginStepStyles.inputGroup}>
        <Text style={[loginStepStyles.label, { color: colors.textSecondary }]}>
          Verification Code
        </Text>
        <View
          style={[
            loginStepStyles.inputContainer,
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
            style={[
              loginStepStyles.input,
              loginStepStyles.otpInput,
              { color: colors.text },
            ]}
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
        {otpError && (
          <Text style={[loginStepStyles.errorText, { color: colors.error }]}>
            {otpError}
          </Text>
        )}
      </View>

      <Pressable
        style={[
          loginStepStyles.primaryButton,
          { backgroundColor: colors.primary },
          isLoading && loginStepStyles.buttonDisabled,
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
          <Text
            style={[
              loginStepStyles.primaryButtonText,
              { color: colors.primaryForeground },
            ]}
          >
            Verify
          </Text>
        )}
      </Pressable>

      <View style={loginStepStyles.resendContainer}>
        <Text style={[loginStepStyles.resendText, { color: colors.textSecondary }]}>
          Didn't receive the code?
        </Text>
        <Pressable onPress={handleResendOtp} disabled={isLoading}>
          <Text style={[loginStepStyles.resendLink, { color: colors.primary }]}>
            Resend
          </Text>
        </Pressable>
      </View>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={[loginStepStyles.title, { color: colors.text }]}>
        Enter Password
      </Text>
      <Text style={[loginStepStyles.subtitle, { color: colors.textSecondary }]}>
        Sign in with your password for {email}
      </Text>

      <View style={loginStepStyles.inputGroup}>
        <Text style={[loginStepStyles.label, { color: colors.textSecondary }]}>
          Password
        </Text>
        <View
          style={[
            loginStepStyles.inputContainer,
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
            style={[loginStepStyles.input, { color: colors.text }]}
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
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            style={({ pressed }) => [
              loginStepStyles.passwordToggle,
              pressed && loginStepStyles.pressablePressed,
            ]}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        {passwordError && (
          <Text style={[loginStepStyles.errorText, { color: colors.error }]}>
            {passwordError}
          </Text>
        )}
      </View>

      <Pressable
        style={[
          loginStepStyles.primaryButton,
          { backgroundColor: colors.primary },
          isLoading && loginStepStyles.buttonDisabled,
        ]}
        onPress={handlePasswordSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text
            style={[
              loginStepStyles.primaryButtonText,
              { color: colors.primaryForeground },
            ]}
          >
            Sign In
          </Text>
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
        style={loginStepStyles.methodToggle}
      >
        <Text style={[loginStepStyles.methodToggleText, { color: colors.primary }]}>
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

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <AppKeyboardAwareScrollView
          style={styles.safeArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
            ? (
                <LoginEmailStep
                  authMethod={authMethod}
                  colors={colors}
                  email={email}
                  emailError={emailError}
                  isAppleLoading={isAppleLoading}
                  isGoogleLoading={isGoogleLoading}
                  isLoading={isLoading}
                  onAppleSignIn={handleAppleSignIn}
                  onContinue={handleContinue}
                  onEmailChange={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError(null);
                  }}
                  onGoogleSignIn={handleGoogleSignIn}
                  onToggleAuthMethod={() =>
                    setAuthMethod(authMethod === 'otp' ? 'password' : 'otp')
                  }
                />
              )
            : step === 'otp'
              ? renderOtpStep()
              : renderPasswordStep()}
        </AppKeyboardAwareScrollView>
      </SafeAreaView>
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
});
