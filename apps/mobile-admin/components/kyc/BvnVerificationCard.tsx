import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation } from '@tanstack/react-query';
import type React from 'react';
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
import { apiClient } from '@/lib/api-client';
import { tryRefreshVerifiedReadiness } from '@/lib/try-refresh-verified-readiness';
import BvnMobileNumberField from './BvnMobileNumberField';
import { showBvnVerificationError } from './bvn-verification-alerts';
import DateOfBirthPicker from './DateOfBirthPicker';
import { isDateInPast, isValidCalendarDate } from './date-utils';
import VerificationStatusBadge from './VerificationStatusBadge';
import { verificationCardStyles as styles } from './verification-card-styles';
import type { VerificationIdentityDraft } from './verification-identity';

interface BvnVerificationCardProps {
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  mobileNo: string;
  onIdentityChange: React.Dispatch<
    React.SetStateAction<VerificationIdentityDraft>
  >;
  onVerified: () => Promise<unknown>;
  verified: boolean;
  prefillBvn?: string | null;
}

const MOBILE_REGEX = /^0\d{10}$/;

export default function BvnVerificationCard({
  verified,
  prefillBvn,
  firstName,
  lastName,
  dateOfBirth,
  mobileNo,
  onIdentityChange,
  onVerified,
}: BvnVerificationCardProps) {
  const { colors, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [bvn, setBvn] = useState(prefillBvn ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const markBvnDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const inputColors = {
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
  };

  // Sync the prefilled BVN during render (guarded prev-compare) instead of in
  // an effect, so the update lands pre-commit without a stale frame.
  const shouldSyncPrefill = !verified && !isDirty;
  const [prevPrefillSync, setPrevPrefillSync] = useState({
    prefillBvn,
    shouldSyncPrefill,
  });
  if (
    prevPrefillSync.prefillBvn !== prefillBvn ||
    prevPrefillSync.shouldSyncPrefill !== shouldSyncPrefill
  ) {
    setPrevPrefillSync({ prefillBvn, shouldSyncPrefill });
    if (shouldSyncPrefill) {
      setBvn(prefillBvn ?? '');
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<{ verified: boolean }>('/api/merchant/verify-bvn', {
        method: 'POST',
        body: JSON.stringify({
          bvn,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          mobileNo: mobileNo.trim(),
        }),
      }),
    onSuccess: async (data) => {
      if (data.verified) {
        const readinessRefreshed =
          await tryRefreshVerifiedReadiness(onVerified);
        Alert.alert(
          'Success',
          readinessRefreshed
            ? 'Your BVN has been verified successfully.'
            : 'Your BVN has been verified successfully. Your setup status will refresh shortly.'
        );
      } else {
        Alert.alert(
          'Verification Failed',
          "The details you provided don't match BVN records."
        );
      }
    },
    onError: showBvnVerificationError,
  });

  const handleSubmit = () => {
    if (mutation.isPending) return;
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
    if (!isDateInPast(dateOfBirth)) {
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
            onChangeText={(v) => {
              markBvnDirty();
              setBvn(v.replace(/\D/g, '').slice(0, 11));
            }}
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
            onChangeText={(v) => {
              onIdentityChange((current) => ({ ...current, firstName: v }));
            }}
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
            onChangeText={(v) => {
              onIdentityChange((current) => ({ ...current, lastName: v }));
            }}
            autoCapitalize="words"
            editable={!verified}
            accessibilityLabel="Last name input"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Date of Birth
          </Text>
          <DateOfBirthPicker
            value={dateOfBirth}
            onChange={(value) => {
              onIdentityChange((current) => ({
                ...current,
                dateOfBirth: value,
              }));
            }}
            colors={colors}
            disabled={verified}
          />

          <BvnMobileNumberField
            colors={colors}
            disabled={mutation.isPending}
            mobileNo={mobileNo}
            onChangeText={(value) => {
              onIdentityChange((current) => ({
                ...current,
                mobileNo: value.replace(/\D/g, '').slice(0, 11),
              }));
            }}
          />

          {!verified && (
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                mutation.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={mutation.isPending || !mobileNo}
              accessibilityRole="button"
              accessibilityLabel="Verify BVN"
              accessibilityState={{ disabled: mutation.isPending || !mobileNo }}
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Verify BVN
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
