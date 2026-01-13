/**
 * Login Screen
 * OTP-based passwordless authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';

import Colors, { BRAND } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/stores/auth-store';
import { EmailSchema, OtpSchema, getFirstError } from '@/lib/validation';

type AuthStep = 'email' | 'otp';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const signInWithOtp = useAuthStore((state) => state.signInWithOtp);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    // Validate email with Zod
    const emailResult = EmailSchema.safeParse(email.trim());
    const error = getFirstError(emailResult);

    if (error) {
      setEmailError(error);
      return;
    }

    setEmailError(null);
    const result = await signInWithOtp(email.toLowerCase().trim());

    if (result.success) {
      setStep('otp');
    } else {
      Alert.alert('Error', result.error || 'Failed to send verification code');
    }
  };

  const handleVerifyOtp = async () => {
    // Validate OTP with Zod
    const otpResult = OtpSchema.safeParse(otp.trim());
    const error = getFirstError(otpResult);

    if (error) {
      setOtpError(error);
      return;
    }

    setOtpError(null);
    const result = await verifyOtp(email.toLowerCase().trim(), otp.trim());

    if (result.success) {
      // Navigate to home on success
      router.replace('/');
    } else {
      Alert.alert('Error', result.error || 'Invalid verification code');
    }
  };

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
    } else {
      router.back();
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
              backgroundColor: colors.card,
              borderColor: emailError ? '#EF4444' : colors.border,
            },
          ]}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={emailError ? '#EF4444' : colors.textSecondary}
          />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="john@example.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>
        {emailError && <Text style={styles.errorText}>{emailError}</Text>}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: BRAND.primary },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleSendOtp}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
        )}
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

      <Pressable
        style={[styles.socialButton, { borderColor: colors.border }]}
        onPress={() =>
          Alert.alert('Coming Soon', 'Google Sign-In will be available soon')
        }
      >
        <Ionicons name="logo-google" size={20} color={colors.text} />
        <Text style={[styles.socialButtonText, { color: colors.text }]}>
          Continue with Google
        </Text>
      </Pressable>

      <Text style={[styles.termsText, { color: colors.textSecondary }]}>
        By continuing, you agree to our{' '}
        <Text style={[styles.link, { color: BRAND.primary }]}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={[styles.link, { color: BRAND.primary }]}>
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
              backgroundColor: colors.card,
              borderColor: otpError ? '#EF4444' : colors.border,
            },
          ]}
        >
          <Ionicons
            name="keypad-outline"
            size={20}
            color={otpError ? '#EF4444' : colors.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.otpInput, { color: colors.text }]}
            placeholder="000000"
            placeholderTextColor={colors.textSecondary}
            value={otp}
            onChangeText={(text) => {
              setOtp(text);
              if (otpError) setOtpError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
          />
        </View>
        {otpError && <Text style={styles.errorText}>{otpError}</Text>}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: BRAND.primary },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleVerifyOtp}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify</Text>
        )}
      </Pressable>

      <View style={styles.resendContainer}>
        <Text style={[styles.resendText, { color: colors.textSecondary }]}>
          Didn't receive the code?
        </Text>
        <Pressable onPress={handleResendOtp} disabled={isLoading}>
          <Text style={[styles.resendLink, { color: BRAND.primary }]}>
            Resend
          </Text>
        </Pressable>
      </View>
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
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Text style={[styles.logoText, { color: BRAND.primary }]}>
                Ogabassey
              </Text>
            </View>

            {step === 'email' ? renderEmailStep() : renderOtpStep()}
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
    color: '#FFFFFF',
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
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
});
