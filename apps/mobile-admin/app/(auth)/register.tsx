import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { BusinessTypeSelector } from '@/components/auth/BusinessTypeSelector';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { DARK_COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme'; // Adjust import path if needed
import { useRegistration } from '@/hooks/useRegistration';
import type { NetworkError } from '@/lib/api-client';
import {
  type PasswordValidationResult,
  validatePassword,
} from '@/lib/password-utils';
import { getEmailError } from '@/lib/sanitize';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useRegistration();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    otherBusinessType: '',
    slug: '',
  });
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  // Validation State
  const [passwordState, setPasswordState] = useState<PasswordValidationResult>({
    isValid: false,
    strength: 0,
    requirements: {
      length: false,
      complexity: false,
      notCommon: false,
      match: true,
    },
  });
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const updateForm = (key: string, value: string) => {
    setFormData((prev) => {
      const updates: Partial<typeof formData> = { [key]: value };

      // Auto-generate slug if business name changes and slug hasn't been manually edited
      if (key === 'businessName' && !isSlugEdited) {
        const firstWord = value.split(' ')[0] || '';
        updates.slug = firstWord
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      // Real-time validation
      if (key === 'password') {
        const result = validatePassword(value, prev.confirmPassword);
        setPasswordState(result);
        if (prev.confirmPassword && value !== prev.confirmPassword) {
          setConfirmError('Passwords do not match');
        } else {
          setConfirmError(null);
        }
      }
      if (key === 'confirmPassword') {
        if (prev.password && value !== prev.password) {
          setConfirmError('Passwords do not match');
        } else {
          setConfirmError(null);
        }
      }

      return { ...prev, ...updates };
    });
  };

  const handleSlugChange = (text: string) => {
    setIsSlugEdited(true);
    // Basic sanitization for manual input (allow hyphens, lowercase)
    const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, slug: sanitized }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        Alert.alert('Error', 'Please enter your first and last name');
        return;
      }

      if (!formData.email || !formData.password || !formData.confirmPassword) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      // Validate email format using Zod schema
      const emailError = getEmailError(formData.email.trim());
      if (emailError) {
        Alert.alert('Invalid Email', emailError);
        return;
      }

      const result = validatePassword(
        formData.password,
        formData.confirmPassword
      );
      if (!result.isValid) {
        Alert.alert(
          'Password too weak',
          result.error || 'Please choose a stronger password.'
        );
        return;
      }

      setStep(2);
    }
  };

  const handleRegister = () => {
    if (!formData.businessName || !formData.businessType) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (
      formData.businessType === 'other' &&
      !formData.otherBusinessType.trim()
    ) {
      Alert.alert('Error', 'Please specify your business type');
      return;
    }

    const email = formData.email.toLowerCase();
    register.mutate(
      {
        email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        businessName: formData.businessName,
        businessType: formData.businessType,
        otherBusinessType: formData.otherBusinessType,
        slug: formData.slug || undefined,
        brandColors: JSON.stringify({
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        }),
        logoUrl: '',
        brandPreferences: '',
      },
      {
        onSuccess: () => {
          // Navigate directly to dashboard — email confirmation is disabled,
          // so signup returns a session immediately and the merchant is ready.
          router.replace('/(admin)/(tabs)');
        },
        onError: (error: Error) => {
          console.error('Registration error:', error.message);
          const networkError = error as NetworkError;

          // Handle specific server error codes
          if (networkError.statusCode === 409) {
            Alert.alert(
              'Account Exists',
              'An account with this email already exists. Please log in instead.',
              [
                {
                  text: 'Go to Login',
                  onPress: () => router.replace('/(auth)/login'),
                },
                { text: 'OK', style: 'cancel' },
              ]
            );
            return;
          }

          if (networkError.statusCode === 429) {
            Alert.alert(
              'Too Many Attempts',
              'Please wait a minute before trying again.'
            );
            return;
          }

          let message = error.message || 'Please try again later.';
          if (networkError.isTimeout) {
            message =
              'The server is taking too long to respond. Please check your connection and try again.';
          } else if (networkError.isOffline) {
            message =
              'Could not reach the server. Please check your internet connection and try again.';
          }

          Alert.alert('Registration Failed', message);
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <SystemBars style="light" />
      <LinearGradient
        colors={['#0D0D1A', '#1A1A2E']}
        style={StyleSheet.absoluteFillObject}
      />

      <AppFormScreen
        contentContainerStyle={styles.content}
        header={
          <View style={styles.header}>
            <Pressable
              onPress={() => (step === 1 ? router.back() : setStep(1))}
              style={styles.backButton}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={{ width: 24 }} />
          </View>
        }
        style={styles.safeArea}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { width: step === 1 ? '50%' : '100%' }]}
          />
        </View>
        <Text style={styles.stepText}>Step {step} of 2</Text>

        {step === 1 ? (
          // Step 1: Account Info
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <Text style={styles.sectionValidation}>Required</Text>

            <View style={styles.nameRow}>
              <View style={styles.nameInputGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="words"
                  value={formData.firstName}
                  onChangeText={(t) => updateForm('firstName', t)}
                />
              </View>
              <View style={styles.nameInputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="words"
                  value={formData.lastName}
                  onChangeText={(t) => updateForm('lastName', t)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(t) => updateForm('email', t)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(t) => updateForm('password', t)}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>

              {/* Password Strength Meter & Checklist */}
              <View style={styles.validationContainer}>
                <Text style={styles.validationTitle}>Password Strength</Text>

                <View style={styles.strengthMeter}>
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          passwordState.strength > 0
                            ? passwordState.strength === 1
                              ? '#EF4444'
                              : passwordState.strength === 2
                                ? '#F59E0B'
                                : '#10B981'
                            : '#374151',
                        width: '32%',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          passwordState.strength > 1
                            ? passwordState.strength === 2
                              ? '#F59E0B'
                              : '#10B981'
                            : '#374151',
                        width: '32%',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          passwordState.strength > 2 ? '#10B981' : '#374151',
                        width: '32%',
                      },
                    ]}
                  />
                </View>

                <View style={styles.checklist}>
                  <View style={styles.checkItem}>
                    <Ionicons
                      name={
                        passwordState.requirements.length
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={14}
                      color={
                        passwordState.requirements.length
                          ? '#10B981'
                          : '#9CA3AF'
                      }
                    />
                    <Text
                      style={
                        passwordState.requirements.length
                          ? styles.checkTextValid
                          : styles.checkText
                      }
                    >
                      At least 8 characters
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <Ionicons
                      name={
                        passwordState.requirements.complexity
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={14}
                      color={
                        passwordState.requirements.complexity
                          ? '#10B981'
                          : '#9CA3AF'
                      }
                    />
                    <Text
                      style={
                        passwordState.requirements.complexity
                          ? styles.checkTextValid
                          : styles.checkText
                      }
                    >
                      Complexity (longer or mixed types)
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <Ionicons
                      name={
                        passwordState.requirements.notCommon
                          ? 'checkmark-circle'
                          : formData.password.length > 0
                            ? 'alert-circle-outline'
                            : 'ellipse-outline'
                      }
                      size={14}
                      color={
                        passwordState.requirements.notCommon
                          ? '#10B981'
                          : formData.password.length > 0
                            ? '#EF4444'
                            : '#9CA3AF'
                      }
                    />
                    <Text
                      style={
                        passwordState.requirements.notCommon
                          ? styles.checkTextValid
                          : formData.password.length > 0
                            ? styles.checkTextError
                            : styles.checkText
                      }
                    >
                      Not a common password
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  value={formData.confirmPassword}
                  onChangeText={(t) => updateForm('confirmPassword', t)}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>
              {confirmError ? (
                <Text style={styles.errorText}>{confirmError}</Text>
              ) : null}
            </View>

            <Pressable style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>Next Step</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </Pressable>
          </View>
        ) : (
          // Step 2: Business Info
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Business Info</Text>
            <Text style={styles.sectionValidation}>
              Tell us about your store
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={styles.input}
                placeholder="My Awesome Store"
                placeholderTextColor="#6B7280"
                value={formData.businessName}
                onChangeText={(t) => updateForm('businessName', t)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Store Link</Text>
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={[styles.urlInput, { textAlign: 'right' }]}
                  placeholder="my-store"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="none"
                  value={formData.slug}
                  onChangeText={handleSlugChange}
                />
                <Text style={styles.urlSuffix}>.usebaci.com</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Type</Text>
              <BusinessTypeSelector
                borderColor={DARK_COLORS.border}
                cardBackgroundColor="rgba(255,255,255,0.05)"
                onSelect={(typeId) => updateForm('businessType', typeId)}
                selectedBackgroundColor={DARK_COLORS.primary}
                selectedBorderColor={DARK_COLORS.primary}
                selectedTextColor="#FFF"
                selectedType={formData.businessType}
                textColor="#9CA3AF"
              />
            </View>

            {formData.businessType === 'other' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Please specify</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Pet Supplies"
                  placeholderTextColor="#6B7280"
                  value={formData.otherBusinessType}
                  onChangeText={(text) => updateForm('otherBusinessType', text)}
                />
              </View>
            )}

            <Pressable
              style={[styles.button, isLoading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Launch Store</Text>
                  <Ionicons name="rocket-outline" size={20} color="#FFF" />
                </>
              )}
            </Pressable>

            <Text style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://usebaci.com/terms')}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://usebaci.com/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        )}
      </AppFormScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    padding: SPACING.lg,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#2A2A40',
    borderRadius: 2,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: DARK_COLORS.primary,
  },
  stepText: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xl,
    textAlign: 'right',
  },
  formSection: {
    gap: SPACING.xl,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  sectionValidation: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.md,
    marginTop: -SPACING.lg, // Pull up closer to title
  },
  inputGroup: {
    gap: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  nameInputGroup: {
    flex: 1,
    gap: SPACING.sm,
  },
  label: {
    color: '#E2E8F0',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  input: {
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
  },
  passwordInput: {
    flex: 1,
    padding: SPACING.md,
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.md,
  },
  eyeButton: {
    padding: SPACING.md,
  },
  button: {
    backgroundColor: DARK_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content horizontally
    paddingVertical: 16, // Increase padding for touch target
    borderRadius: RADIUS.full,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    shadowColor: DARK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
    overflow: 'hidden',
  },
  urlSuffix: {
    color: '#9CA3AF',
    paddingRight: SPACING.md,
    paddingLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: '100%',
    textAlignVertical: 'center',
    paddingVertical: SPACING.md, // Match input padding
  },
  urlInput: {
    flex: 1,
    color: '#FFF',
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  termsText: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 20,
  },
  termsLink: {
    color: DARK_COLORS.primary,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  validationContainer: {
    marginTop: 12,
    gap: 8,
  },
  validationTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  strengthMeter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  checklist: {
    marginTop: 4,
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    color: '#6B7280',
    fontSize: 12,
  },
  checkTextValid: {
    color: '#10B981',
    fontSize: 12,
  },
  checkTextError: {
    color: '#EF4444',
    fontSize: 12,
  },
});
