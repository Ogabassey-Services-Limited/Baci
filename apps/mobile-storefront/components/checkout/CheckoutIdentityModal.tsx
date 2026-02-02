/**
 * Checkout Identity Modal - Ogabassey Design
 * Bottom sheet modal for checkout identity selection
 *
 * 2026 Best Practice:
 * - Native bottom sheet animation
 * - Haptic feedback on interactions
 * - Matches web modal design
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

interface CheckoutIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'new' | 'signin';

export function CheckoutIdentityModal({
  isOpen,
  onClose,
}: CheckoutIdentityModalProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values - smooth timing, no bounce
  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      // Smooth slide up without bouncing
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(500, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleClose = () => {
    triggerHaptic();
    Keyboard.dismiss();
    onClose();
  };

  const handleGuestCheckout = () => {
    triggerHaptic();
    onClose();
    router.push('/checkout');
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    triggerHaptic();
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      onClose();
      router.push('/checkout');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    triggerHaptic();
    onClose();
    router.push('/auth/login?mode=register&redirect=checkout');
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, animatedBackdrop]}>
          <Pressable style={styles.backdropPressable} onPress={handleClose} />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            animatedSheet,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Checkout</Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={palette.gray[500]} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, activeTab === 'new' && styles.tabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveTab('new');
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={activeTab === 'new' ? BRAND.primary : palette.gray[500]}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'new' && styles.tabTextActive,
                ]}
              >
                New Customer
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'signin' && styles.tabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveTab('signin');
              }}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={
                  activeTab === 'signin' ? BRAND.primary : palette.gray[500]
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'signin' && styles.tabTextActive,
                ]}
              >
                Sign In
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {activeTab === 'new' ? (
              <>
                {/* Guest Checkout */}
                <View style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Ionicons name="flash" size={16} color="#F59E0B" />
                    <Text style={styles.optionTitle}>Guest Checkout</Text>
                  </View>
                  <Text style={styles.optionDescription}>
                    Fastest way to checkout. Create an account later if you
                    wish.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: '#DC2626' }, // Explicit Red
                      pressed && styles.primaryButtonPressed,
                    ]}
                    onPress={handleGuestCheckout}
                  >
                    <Text style={styles.primaryButtonText}>
                      Continue as Guest
                    </Text>
                  </Pressable>
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Create Account */}
                <View style={[styles.optionCard, styles.optionCardSecondary]}>
                  <View
                    style={[styles.optionHeader, styles.optionHeaderCentered]}
                  >
                    <Ionicons name="person-add" size={16} color="#DC2626" />
                    <Text style={styles.optionTitle}>Create Account</Text>
                  </View>
                  <Text
                    style={[
                      styles.optionDescription,
                      styles.optionDescriptionCentered,
                    ]}
                  >
                    Save your details for faster checkout next time.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                    onPress={handleRegister}
                  >
                    <Text style={styles.secondaryButtonText}>Register Now</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {/* Sign In Form */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons
                      name="alert-circle"
                      size={16}
                      color={BRAND.primary}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor={palette.gray[400]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <Pressable
                      onPress={() => router.push('/auth/login?mode=forgot')}
                    >
                      <Text style={styles.forgotLink}>Forgot?</Text>
                    </Pressable>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter password"
                      placeholderTextColor={palette.gray[400]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <Pressable
                      style={styles.showPasswordButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.showPasswordText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: '#DC2626' }, // Explicit Red
                    pressed && styles.primaryButtonPressed,
                    isLoading && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="person" size={16} color="#FFF" />
                      <Text style={styles.primaryButtonText}>
                        Sign In & Checkout
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="lock-closed" size={12} color={palette.gray[400]} />
            <Text style={styles.footerText}>
              Your security is our priority. All transactions are encrypted.
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: palette.gray[300],
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
    backgroundColor: palette.gray[50],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray[900],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gray[100],
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: BRAND.primary,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray[500],
  },
  tabTextActive: {
    color: BRAND.primary,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg, // Increased gap for clarity
  },
  optionCard: {
    padding: 20,
    backgroundColor: '#FFFFFF', // Clean White
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.gray[100],
    ...SHADOWS.sm,
  },
  optionCardSecondary: {
    backgroundColor: '#FFFFFF', // Clean White to match web
    borderColor: '#FEE2E2', // light red border
    alignItems: 'center',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  optionHeaderCentered: {
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.gray[900],
  },
  optionDescription: {
    fontSize: 12,
    color: palette.gray[500],
    marginBottom: 16,
  },
  optionDescriptionCentered: {
    textAlign: 'center',
    color: palette.gray[600],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626', // red-600
    paddingVertical: 16,
    borderRadius: 12, // rounded-xl
    ...SHADOWS.lg,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#B91C1C', // red-700
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    width: '100%',
    borderRadius: 100, // Pill style matches web register button better
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  secondaryButtonPressed: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.gray[200],
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray[400],
    textTransform: 'uppercase',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.primary,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray[700],
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.primary,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: palette.gray[900],
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: RADIUS.lg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: palette.gray[900],
  },
  showPasswordButton: {
    paddingHorizontal: 12,
  },
  showPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray[500],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    backgroundColor: palette.gray[50],
    borderTopWidth: 1,
    borderTopColor: palette.gray[100],
  },
  footerText: {
    fontSize: 10,
    color: palette.gray[400],
    fontWeight: '500',
  },
});
