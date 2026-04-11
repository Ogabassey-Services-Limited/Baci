/**
 * KYC Verification Screen
 * Real identity verification for merchants via NIN, BVN, and CAC APIs.
 * Owner-only: staff users see a read-only message.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import BvnVerificationCard from '@/components/kyc/BvnVerificationCard';
import CacVerificationCard from '@/components/kyc/CacVerificationCard';
import NinVerificationCard from '@/components/kyc/NinVerificationCard';
import type { VerificationIdentityDraft } from '@/components/kyc/verification-identity';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface VerificationStatus {
  nin_verified: boolean;
  bvn_verified: boolean;
  cac_verified: boolean;
  cac_approved_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.nin_verified === 'boolean' &&
    typeof v.bvn_verified === 'boolean' &&
    typeof v.cac_verified === 'boolean'
  );
}

function normalizeBvnMobileNumber(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, '') ?? '';

  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 13 && digits.startsWith('234')) {
    return `0${digits.slice(3)}`;
  }

  return '';
}

export default function KYCScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { merchant } = useMerchant();
  const lastMerchantIdRef = useRef<string | null>(null);
  const [identityDraft, setIdentityDraft] = useState<VerificationIdentityDraft>(
    {
      dateOfBirth: '',
      firstName: '',
      lastName: '',
      mobileNo: '',
    }
  );

  const isOwner =
    !!user?.id && !!merchant?.user_id && user.id === merchant.user_id;

  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['verification-status', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) throw new Error('Merchant ID is required');
      const { data, error } = await supabase.rpc(
        'get_merchant_verification_status',
        { p_merchant_id: merchant.id }
      );
      if (error) throw error;
      if (!isVerificationStatus(data)) {
        throw new Error(
          'Invalid verification status payload from get_merchant_verification_status'
        );
      }
      return data;
    },
    enabled: isOwner && !!merchant?.id,
  });

  useEffect(() => {
    const merchantId = merchant?.id ?? null;
    const merchantChanged = lastMerchantIdRef.current !== merchantId;

    setIdentityDraft((current) => ({
      dateOfBirth: merchantChanged
        ? status?.date_of_birth || ''
        : current.dateOfBirth || status?.date_of_birth || '',
      firstName: merchantChanged
        ? status?.first_name || ''
        : current.firstName || status?.first_name || '',
      lastName: merchantChanged
        ? status?.last_name || ''
        : current.lastName || status?.last_name || '',
      mobileNo: merchantChanged
        ? normalizeBvnMobileNumber(merchant?.phone) || ''
        : current.mobileNo || normalizeBvnMobileNumber(merchant?.phone) || '',
    }));
    lastMerchantIdRef.current = merchantId;
  }, [
    merchant?.id,
    merchant?.phone,
    status?.date_of_birth,
    status?.first_name,
    status?.last_name,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Identity Verification',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={40}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              KYC Verification
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Verify your identity to enable full payment features and build
              customer trust.
            </Text>
          </View>

          {!isOwner ? (
            <View
              style={[styles.ownerOnlyBanner, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={24}
                color={colors.textMuted}
              />
              <Text
                style={[styles.ownerOnlyText, { color: colors.textSecondary }]}
              >
                Only the store owner can verify identity. Contact your store
                owner to complete verification.
              </Text>
            </View>
          ) : isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : isError ? (
            <View
              style={[styles.ownerOnlyBanner, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={colors.error}
              />
              <View style={styles.errorBody}>
                <Text
                  style={[
                    styles.ownerOnlyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Failed to load verification status.
                </Text>
                <Pressable onPress={() => refetch()} accessibilityRole="button">
                  <Text
                    style={[styles.tryAgainText, { color: colors.primary }]}
                  >
                    Try Again
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.cards}>
              <NinVerificationCard
                verified={status?.nin_verified ?? false}
                prefillNin={merchant?.nin}
                firstName={identityDraft.firstName}
                lastName={identityDraft.lastName}
                dateOfBirth={identityDraft.dateOfBirth}
                onIdentityChange={setIdentityDraft}
                onVerified={refetch}
              />
              <BvnVerificationCard
                verified={status?.bvn_verified ?? false}
                prefillBvn={merchant?.bvn}
                firstName={identityDraft.firstName}
                lastName={identityDraft.lastName}
                dateOfBirth={identityDraft.dateOfBirth}
                mobileNo={identityDraft.mobileNo}
                onIdentityChange={setIdentityDraft}
                onVerified={refetch}
              />
              <CacVerificationCard
                verified={status?.cac_verified ?? false}
                prefillRcNumber={merchant?.cac_rc_number}
                cacApprovedName={status?.cac_approved_name}
                onVerified={refetch}
              />
            </View>
          )}

          <View style={styles.securityNote}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text
              style={[styles.securityNoteText, { color: colors.textMuted }]}
            >
              Your data is encrypted and used only for verification purposes.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  cards: { gap: SPACING.lg },
  loader: { marginTop: SPACING['2xl'] },
  ownerOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  ownerOnlyText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xl,
  },
  securityNoteText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  tryAgainText: {
    marginTop: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  errorBody: {
    flex: 1,
  },
});
