import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DARK_COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']); // 6 digits
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // Custom success state
  const [timer, setTimer] = useState(30); // 30s countdown for resend
  const inputs = useRef<Array<TextInput | null>>([]);

  // Refs for proper cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isMountedRef = useRef(true);

  // Cleanup all timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, []);

  // Extract the condition to a variable for proper static analysis
  const isTimerActive = timer > 0;

  // Timer countdown effect - only start interval when timer > 0
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isTimerActive) {
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setTimer((t) => {
            if (t <= 1) {
              // Clear interval when timer reaches 0
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              return 0;
            }
            return t - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerActive]); // Only re-run when timer transitions between 0 and >0

  // H-3: Guard against missing or invalid email param (placed after all hooks)
  if (typeof email !== 'string' || !email.trim()) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit if all filled
    if (index === 5 && text) {
      // verifyCode(newCode.join('') + text.slice(-1)); // careful with state updates
      // better to use explicit submit or updated array
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const token = code.join('');
    if (token.length !== 6) {
      Alert.alert('Error', 'Please enter a complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup', // or 'email' depending on context. For new signups 'signup' is safer usually.
        // However, if they are already "signed up" but unverified, 'email' might work.
        // Let's try 'signup' first as this is the registration flow.
      });

      if (error) throw error;

      // Verification successful!
      // Session is automatically updated by the Supabase client
      // which triggers the useAuth listener.

      // Verification successful!
      // Show custom success view
      setShowSuccess(true);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Verification error:', err);
      // Fallback: try 'email' type if 'signup' failed (edge case)
      try {
        const { error: retryError } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });
        if (!retryError) {
          setShowSuccess(true);
          return;
        }
        Alert.alert('Verification Failed', err.message || 'Invalid code');
      } catch (_e) {
        Alert.alert('Verification Failed', err.message || 'Invalid code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (timer > 0) return;
    setIsLoading(true);
    try {
      // Use signInWithOtp instead of auth.resend — resend() bypasses the
      // custom Send Email Hook (send-auth-email edge function → ZeptoMail),
      // causing emails to silently fail since no SMTP is configured.
      // Note: signInWithOtp produces type:'email' OTPs, but verifyOtp handles
      // this via its type:'signup' → type:'email' fallback chain.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      Alert.alert('Sent', 'A new code has been sent to your email.');
      setTimer(60);
    } catch (error: unknown) {
      const err = error as Error;
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SystemBars style="light" />
      <LinearGradient
        colors={['#0D0D1A', '#1A1A2E']}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a code to{' '}
            <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{email}</Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputs.current[index] = ref;
              }}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              placeholder="-"
              placeholderTextColor="#4B5563"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
            />
          ))}
        </View>

        <Pressable
          style={[styles.button, isLoading && { opacity: 0.7 }]}
          onPress={verifyOtp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Verify Email</Text>
          )}
        </Pressable>

        <Pressable
          onPress={resendCode}
          disabled={timer > 0 || isLoading}
          style={styles.resendButton}
        >
          <Text style={[styles.resendText, timer > 0 && { color: '#6B7280' }]}>
            {timer > 0 ? `Resend code in ${timer}s` : "I didn't receive a code"}
          </Text>
        </Pressable>
      </SafeAreaView>

      {/* Custom Success Modal Overlay */}
      {showSuccess && (
        <View style={[StyleSheet.absoluteFill, styles.successOverlay]}>
          <View style={styles.successCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark" size={40} color="#FFF" />
            </View>
            <Text style={styles.successTitle}>Verified!</Text>
            <Text style={styles.successMessage}>
              Your email has been successfully verified. Welcome to Baci.
            </Text>
            <Pressable
              style={styles.successButton}
              onPress={() => {
                // Dismiss the modal — the auth layout will handle the redirect
                // once the auth state updates from the Supabase listener
                router.dismissAll();
              }}
            >
              <Text style={styles.successButtonText}>Enter Dashboard</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    paddingTop: SPACING['3xl'], // Extra top padding
  },
  header: {
    marginBottom: SPACING['3xl'],
  },
  backButton: {
    marginBottom: SPACING.lg,
  },
  title: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size['3xl'], // 30px
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: DARK_COLORS.inputBg,
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.xl,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  button: {
    backgroundColor: DARK_COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  buttonText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  resendButton: {
    alignItems: 'center',
    padding: SPACING.md,
  },
  resendText: {
    color: DARK_COLORS.primary, // Brand color for link
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  // Success Modal Styles
  successOverlay: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    zIndex: 100, // Ensure it sits on top
  },
  successCard: {
    width: '100%',
    backgroundColor: '#1E1E2E', // Slightly lighter than background
    borderRadius: RADIUS.xl,
    padding: SPACING['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.51,
    shadowRadius: 13.16,
    elevation: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981', // Emerald Green for success
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successTitle: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
  },
  successMessage: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
    lineHeight: 24,
  },
  successButton: {
    width: '100%',
    backgroundColor: '#FFF', // High contrast white button
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  successButtonText: {
    color: '#000',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
