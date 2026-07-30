import Ionicons from '@react-native-vector-icons/ionicons';
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
import { apiClient } from '@/lib/api-client';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import BvnMobileNumberField from './BvnMobileNumberField';
import { showBvnVerificationError } from './bvn-verification-alerts';
import { isDateInPast, isValidCalendarDate } from './date-utils';
import VerificationStatusBadge from './VerificationStatusBadge';
import { verificationCardStyles as styles } from './verification-card-styles';

interface BvnVerificationCardProps {
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  merchantId?: string | null;
  mobileNo: string;
  onMobileNumberChange: (value: string) => void;
  onVerified: () => Promise<unknown>;
  isActive?: () => boolean;
  verified: boolean;
  prefillBvn?: string | null;
}

const MOBILE_REGEX = /^0\d{10}$/;

type BvnMismatchField = 'name' | 'date_of_birth' | 'mobile_number';

interface BvnVerificationResponse {
  mismatchFields?: BvnMismatchField[];
  verified: boolean;
}

function getMismatchMessage(mismatchFields?: BvnMismatchField[]): string {
  if (mismatchFields?.length === 1) {
    if (mismatchFields[0] === 'mobile_number') {
      return 'The mobile number does not match your BVN records.';
    }
    if (mismatchFields[0] === 'date_of_birth') {
      return 'The date of birth does not match your BVN records.';
    }
    if (mismatchFields[0] === 'name') {
      return 'The name does not match your BVN records.';
    }
  }

  return "The details you provided don't match BVN records.";
}

export default function BvnVerificationCard({
  verified,
  prefillBvn,
  firstName,
  lastName,
  merchantId,
  dateOfBirth,
  mobileNo,
  onMobileNumberChange,
  onVerified,
  isActive = () => true,
}: BvnVerificationCardProps) {
  const { colors } = useTheme();
  const [bvn, setBvn] = useState(prefillBvn ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const inputColors = {
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
  };

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
    if (shouldSyncPrefill) setBvn(prefillBvn ?? '');
  }

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<BvnVerificationResponse>('/api/merchant/verify-bvn', {
        method: 'POST',
        body: JSON.stringify({
          merchantId,
          bvn,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          mobileNo: mobileNo.trim(),
        }),
      }),
    onSuccess: async (data) => {
      if (data.verified) {
        const readinessRefreshed = await tryRefreshStoreReadiness(onVerified);
        if (!isActive()) return;

        Alert.alert(
          'Success',
          readinessRefreshed
            ? 'Your BVN has been verified successfully.'
            : 'Your BVN has been verified successfully. Your setup status will refresh shortly.'
        );
      } else if (!data.verified && isActive()) {
        Alert.alert(
          'Verification Failed',
          getMismatchMessage(data.mismatchFields)
        );
      }
    },
    onError: (error: unknown) => {
      if (isActive()) showBvnVerificationError(error);
    },
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
    <View style={[styles.embeddedSection, { borderTopColor: colors.border }]}>
      <View style={styles.stepHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <Text style={[styles.stepTitle, { color: colors.text }]}>
            BVN Verification
          </Text>
        </View>
        <VerificationStatusBadge
          status={verified ? 'verified' : 'not-started'}
        />
      </View>

      {!verified && (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            BVN
          </Text>
          <TextInput
            style={[styles.input, inputColors]}
            placeholder="12345678901"
            placeholderTextColor={colors.textMuted}
            value={bvn}
            onChangeText={(value) => {
              if (!isDirty) setIsDirty(true);
              setBvn(value.replace(/\D/g, '').slice(0, 11));
            }}
            keyboardType="number-pad"
            maxLength={11}
            accessibilityLabel="BVN input"
          />

          <BvnMobileNumberField
            colors={colors}
            disabled={mutation.isPending}
            mobileNo={mobileNo}
            onChangeText={onMobileNumberChange}
          />

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
        </>
      )}
    </View>
  );
}
