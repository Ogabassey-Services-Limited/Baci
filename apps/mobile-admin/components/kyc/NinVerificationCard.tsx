import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { apiClient, NetworkError } from '@/lib/api-client';
import { isValidCalendarDate } from './date-utils';
import VerificationStatusBadge from './VerificationStatusBadge';
import { verificationCardStyles as styles } from './verification-card-styles';

interface NinVerificationCardProps {
  verified: boolean;
  prefillFirstName?: string | null;
  prefillLastName?: string | null;
  prefillDob?: string | null;
  prefillNin?: string | null;
  onVerified: () => void;
}

interface VerifyNinResponse {
  verified: boolean;
}

export default function NinVerificationCard({
  verified,
  prefillFirstName,
  prefillLastName,
  prefillDob,
  prefillNin,
  onVerified,
}: NinVerificationCardProps) {
  const { colors, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [nin, setNin] = useState(prefillNin ?? '');
  const [firstName, setFirstName] = useState(prefillFirstName ?? '');
  const [lastName, setLastName] = useState(prefillLastName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(prefillDob ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<VerifyNinResponse>('/api/merchant/verify-nin', {
        method: 'POST',
        body: JSON.stringify({
          nin,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
        }),
      }),
    onSuccess: (data) => {
      if (data.verified) {
        Alert.alert('Success', 'Your NIN has been verified successfully.');
        onVerified();
      } else {
        Alert.alert(
          'Verification Failed',
          "The details you provided don't match NIN records."
        );
      }
    },
    onError: (error: unknown) => {
      if (error instanceof NetworkError && error.statusCode === 429) {
        Alert.alert(
          'Rate Limited',
          'Rate limit exceeded. Please wait a minute and try again.'
        );
        return;
      }
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Error', message);
    },
  });

  const handleSubmit = () => {
    if (!/^\d{11}$/.test(nin)) {
      Alert.alert('Invalid NIN', 'NIN must be exactly 11 digits.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing Fields', 'Please enter your first and last name.');
      return;
    }
    if (!isValidCalendarDate(dateOfBirth)) {
      Alert.alert(
        'Invalid Date',
        'Please enter a valid date of birth in YYYY-MM-DD format.'
      );
      return;
    }
    mutation.mutate();
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        shadows.sm,
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Toggle NIN verification section"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="id-card-outline" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            NIN Verification
          </Text>
        </View>
        <View style={styles.headerRight}>
          <VerificationStatusBadge verified={verified} />
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {verified && (
            <View
              style={[
                styles.verifiedBanner,
                { backgroundColor: colors.successLight },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.success}
              />
              <Text style={[styles.verifiedText, { color: colors.success }]}>
                Your NIN has been verified
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            NIN
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
            placeholder="12345678901"
            placeholderTextColor={colors.textMuted}
            value={nin}
            onChangeText={(v) => setNin(v.replace(/\D/g, '').slice(0, 11))}
            keyboardType="number-pad"
            maxLength={11}
            editable={!verified}
            accessibilityLabel="NIN input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            First Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!verified}
            accessibilityLabel="First name input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Last Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
            placeholder="Last name"
            placeholderTextColor={colors.textMuted}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!verified}
            accessibilityLabel="Last name input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Date of Birth
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            editable={!verified}
            accessibilityLabel="Date of birth input"
          />

          {!verified && (
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                mutation.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Verify NIN"
              accessibilityState={{ disabled: mutation.isPending }}
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Verify NIN</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
