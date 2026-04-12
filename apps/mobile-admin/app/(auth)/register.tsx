import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { RegisterAccountStep } from '@/components/auth/register/RegisterAccountStep';
import { RegisterBusinessStep } from '@/components/auth/register/RegisterBusinessStep';
import { registerStyles as styles } from '@/components/auth/register/register.styles';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import type { BusinessTypeId } from '@/constants/business-types';
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

  const updateForm = <K extends keyof typeof formData>(
    key: K,
    value: (typeof formData)[K]
  ) => {
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

      if (key === 'businessType' && value !== 'other') {
        updates.otherBusinessType = '';
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
          <RegisterAccountStep
            confirmError={confirmError}
            formData={formData}
            onNext={handleNext}
            passwordState={passwordState}
            showPassword={showPassword}
            updateForm={updateForm}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
          />
        ) : (
          <RegisterBusinessStep
            formData={formData}
            isLoading={isLoading}
            onBusinessNameChange={(text) => updateForm('businessName', text)}
            onBusinessTypeChange={(typeId: BusinessTypeId) =>
              updateForm('businessType', typeId)
            }
            onLaunchStore={handleRegister}
            onOtherBusinessTypeChange={(text) =>
              updateForm('otherBusinessType', text)
            }
            onSlugChange={handleSlugChange}
          />
        )}
      </AppFormScreen>
    </View>
  );
}
