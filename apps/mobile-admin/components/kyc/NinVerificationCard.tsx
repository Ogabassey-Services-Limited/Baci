import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation } from '@tanstack/react-query';
import type React from 'react';
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
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import BvnVerificationCard from './BvnVerificationCard';
import DateOfBirthPicker from './DateOfBirthPicker';
import { isDateInPast, isValidCalendarDate } from './date-utils';
import IdentityNameFields from './IdentityNameFields';
import VerificationStatusBadge from './VerificationStatusBadge';
import { verificationCardStyles as styles } from './verification-card-styles';
import type { VerificationIdentityDraft } from './verification-identity';

interface NinVerificationCardProps {
  bvnVerified: boolean;
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  merchantId?: string | null;
  mobileNo: string;
  onIdentityChange: React.Dispatch<
    React.SetStateAction<VerificationIdentityDraft>
  >;
  onVerified: () => Promise<unknown>;
  isActive?: () => boolean;
  prefillBvn?: string | null;
  prefillNin?: string | null;
  verified: boolean;
}

type VerifyNinResponse = { verified: boolean };

export default function NinVerificationCard({
  bvnVerified,
  verified,
  prefillBvn,
  prefillNin,
  firstName,
  lastName,
  merchantId,
  dateOfBirth,
  mobileNo,
  onIdentityChange,
  onVerified,
  isActive = () => true,
}: NinVerificationCardProps) {
  const { colors, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [nin, setNin] = useState(prefillNin ?? '');
  const isFullyVerified = verified && bvnVerified;
  useEffect(() => {
    if (isFullyVerified) setExpanded(false);
  }, [isFullyVerified]);
  const [prevPrefillNin, setPrevPrefillNin] = useState(prefillNin);
  const [prevVerified, setPrevVerified] = useState(verified);
  if (prefillNin !== prevPrefillNin || verified !== prevVerified) {
    setPrevPrefillNin(prefillNin);
    setPrevVerified(verified);
    if (!verified) setNin(prefillNin ?? '');
  }
  const mutation = useMutation({
    mutationFn: () =>
      apiClient<VerifyNinResponse>('/api/merchant/verify-nin', {
        method: 'POST',
        body: JSON.stringify({
          merchantId,
          nin,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth.trim(),
        }),
      }),
    onSuccess: async (data) => {
      if (data.verified) {
        const readinessRefreshed = await tryRefreshStoreReadiness(onVerified);
        if (!isActive()) return;
        Alert.alert(
          'Success',
          readinessRefreshed
            ? 'Your NIN has been verified successfully.'
            : 'Your NIN has been verified successfully. Your setup status will refresh shortly.'
        );
      } else if (!data.verified && isActive()) {
        Alert.alert(
          'Verification Failed',
          "The details you provided don't match NIN records."
        );
      }
    },
    onError: (error: unknown) => {
      if (!isActive()) return;
      if (error instanceof NetworkError && error.statusCode === 429) {
        Alert.alert(
          'Rate Limited',
          'Rate limit exceeded. Please wait a minute and try again.'
        );
        return;
      }
      console.error(
        'NIN verification error:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      Alert.alert(
        'Verification Error',
        'Unable to verify NIN. Please check your connection and try again.'
      );
    },
  });

  const handleSubmit = () => {
    if (mutation.isPending) return;
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
    if (!isDateInPast(dateOfBirth)) {
      Alert.alert('Invalid Date', 'Date of birth must be in the past.');
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
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel="Toggle identity verification"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="id-card-outline" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Identity Verification
          </Text>
        </View>
        <View style={styles.headerRight}>
          <VerificationStatusBadge
            label={verified && !bvnVerified ? 'BVN Pending' : undefined}
            status={
              bvnVerified ? 'verified' : verified ? 'pending' : 'not-started'
            }
          />
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
            onChangeText={(value) =>
              setNin(value.replace(/\D/g, '').slice(0, 11))
            }
            keyboardType="number-pad"
            maxLength={11}
            editable={!verified}
            accessibilityLabel="NIN input"
          />

          <IdentityNameFields
            colors={colors}
            disabled={bvnVerified}
            firstName={firstName}
            lastName={lastName}
            onIdentityChange={onIdentityChange}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Date of Birth
          </Text>
          <DateOfBirthPicker
            value={dateOfBirth}
            onChange={(value) =>
              onIdentityChange((current) => ({
                ...current,
                dateOfBirth: value,
              }))
            }
            colors={colors}
            disabled={bvnVerified}
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
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Verify NIN
                </Text>
              )}
            </Pressable>
          )}

          <BvnVerificationCard
            verified={bvnVerified}
            prefillBvn={prefillBvn}
            firstName={firstName}
            lastName={lastName}
            dateOfBirth={dateOfBirth}
            mobileNo={mobileNo}
            merchantId={merchantId}
            onMobileNumberChange={(value) =>
              onIdentityChange((current) => ({
                ...current,
                mobileNo: value.replace(/\D/g, '').slice(0, 11),
              }))
            }
            isActive={isActive}
            onVerified={onVerified}
          />
        </View>
      )}
    </View>
  );
}
