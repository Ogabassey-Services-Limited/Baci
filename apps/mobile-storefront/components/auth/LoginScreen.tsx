import Ionicons from "@react-native-vector-icons/ionicons";
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LoginAuthMethod } from '@/components/auth/LoginEmailStep';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { createLogger } from '@/lib/logger';
import { EmailSchema, getFirstError } from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';
import { LoginScreenContent } from './LoginScreenContent';
import { loginScreenStyles as styles } from './LoginScreen.styles';
import { runLoginSocialSignIn } from './login-social-sign-in';

const log = createLogger('Login');

type AuthStep = 'email' | 'otp' | 'password';

export function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

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

  const { withKeyboardDismiss } = useKeyboard();

  const otpInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  const isVerifyingRef = useRef(false);

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

  const handleGoogleSignIn = async () => {
    await runLoginSocialSignIn({
      errorMessage: 'Failed to sign in with Google',
      loading: setIsGoogleLoading,
      log,
      provider: 'Google',
      signIn: signInWithGoogle,
    });
  };

  const handleAppleSignIn = async () => {
    await runLoginSocialSignIn({
      errorMessage: 'Failed to sign in with Apple',
      loading: setIsAppleLoading,
      log,
      provider: 'Apple',
      signIn: signInWithApple,
    });
  };

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
          <LoginScreenContent
            authMethod={authMethod}
            colorScheme={colorScheme}
            colors={colors}
            dismissAndNavigate={dismissAndNavigate}
            email={email}
            emailError={emailError}
            handleAppleSignIn={handleAppleSignIn}
            handleContinue={handleContinue}
            handleGoogleSignIn={handleGoogleSignIn}
            handlePasswordSignIn={handlePasswordSignIn}
            handleResendOtp={handleResendOtp}
            isAppleLoading={isAppleLoading}
            isGoogleLoading={isGoogleLoading}
            isLoading={isLoading}
            isMountedRef={isMountedRef}
            isVerifyingRef={isVerifyingRef}
            otp={otp}
            otpError={otpError}
            otpInputRef={otpInputRef}
            password={password}
            passwordError={passwordError}
            setAuthMethod={setAuthMethod}
            setEmail={setEmail}
            setEmailError={setEmailError}
            setOtp={setOtp}
            setOtpError={setOtpError}
            setPassword={setPassword}
            setPasswordError={setPasswordError}
            setShowPassword={setShowPassword}
            setStep={setStep}
            showPassword={showPassword}
            signInWithOtp={signInWithOtp}
            step={step}
            verifyOtp={verifyOtp}
          />
        </AppKeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}
