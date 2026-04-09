import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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

interface BvnVerificationCardProps {
  verified: boolean;
  prefillFirstName?: string | null;
  prefillLastName?: string | null;
  prefillDob?: string | null;
  prefillBvn?: string | null;
  prefillMobileNo?: string | null;
  onVerified: () => void;
}

interface VerifyBvnResponse {
  verified: boolean;
}

const MOBILE_REGEX = /^0\d{10}$/;

export default function BvnVerificationCard({
  verified,
  prefillFirstName,
  prefillLastName,
  prefillDob,
  prefillBvn,
  prefillMobileNo,
  onVerified,
}: BvnVerificationCardProps) {
  const { colors, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [bvn, setBvn] = useState(prefillBvn ?? '');
  const [firstName, setFirstName] = useState(prefillFirstName ?? '');
  const [lastName, setLastName] = useState(prefillLastName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(prefillDob ?? '');
  const [mobileNo, setMobileNo] = useState(prefillMobileNo ?? '');
  const inputColors = {
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
  };

  useEffect(() => {
    if (!verified) {
      setBvn(prefillBvn ?? '');
      setFirstName(prefillFirstName ?? '');
      setLastName(prefillLastName ?? '');
      setDateOfBirth(prefillDob ?? '');
      setMobileNo(prefillMobileNo ?? '');
    }
  }, [
    prefillBvn,
    prefillFirstName,
    prefillLastName,
    prefillDob,
    prefillMobileNo,
    verified,
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<VerifyBvnResponse>('/api/merchant/verify-bvn', {
        method: 'POST',
        body: JSON.stringify({
          bvn,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          mobileNo,
        }),
      }),
    onSuccess: (data) => {
      if (data.verified) {
        Alert.alert('Success', 'Your BVN has been verified successfully.');
        onVerified();
      } else {
        Alert.alert(
          'Verification Failed',
          "The details you provided don't match BVN records."
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
      console.error('BVN verification error:', error);
      Alert.alert(
        'Verification Error',
        'Unable to verify BVN. Please check your connection and try again.'
      );
    },
  });

  const handleSubmit = () => {
    if (!/^\d{11}$/.test(bvn)) {
      Alert.alert('Invalid BVN', 'BVN must be exactly 11 digits.');
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
    if (new Date(dateOfBirth) >= new Date()) {
      Alert.alert('Invalid Date', 'Date of birth must be in the past.');
      return;
    }
    if (!MOBILE_REGEX.test(mobileNo)) {
      Alert.alert(
        'Invalid Mobile Number',
        'Please enter a valid 11-digit mobile number starting with 0.'
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
        accessibilityLabel="Toggle BVN verification section"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="card-outline" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            BVN Verification
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
                Your BVN has been verified
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            BVN
          </Text>
          <TextInput
            style={[styles.input, inputColors]}
            placeholder="12345678901"
            placeholderTextColor={colors.textMuted}
            value={bvn}
            onChangeText={(v) => setBvn(v.replace(/\D/g, '').slice(0, 11))}
            keyboardType="number-pad"
            maxLength={11}
            editable={!verified}
            accessibilityLabel="BVN input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            First Name
          </Text>
          <TextInput
            style={[styles.input, inputColors]}
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
            style={[styles.input, inputColors]}
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
            style={[styles.input, inputColors]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            editable={!verified}
            accessibilityLabel="Date of birth input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Mobile Number
          </Text>
          <TextInput
            style={[styles.input, inputColors]}
            placeholder="08012345678"
            placeholderTextColor={colors.textMuted}
            value={mobileNo}
            onChangeText={(v) => setMobileNo(v.replace(/\D/g, '').slice(0, 11))}
            keyboardType="phone-pad"
            maxLength={11}
            editable={!verified}
            accessibilityLabel="Mobile number input"
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
              accessibilityLabel="Verify BVN"
              accessibilityState={{ disabled: mutation.isPending }}
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Verify BVN</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
