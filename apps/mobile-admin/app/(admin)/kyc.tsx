/**
 * KYC Verification Screen
 * Real identity verification for merchants via NIN, BVN, and CAC APIs.
 * Owner-only: staff users see a read-only message.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import {
  ActivityIndicator,
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

export default function KYCScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { merchant } = useMerchant();

  const isOwner =
    !!user?.id && !!merchant?.user_id && user.id === merchant.user_id;

  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['verification-status', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_merchant_verification_status',
        { p_merchant_id: merchant?.id }
      );
      if (error) throw error;
      return data as VerificationStatus;
    },
    enabled: isOwner && !!merchant?.id,
  });

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
          ) : (
            <View style={styles.cards}>
              <NinVerificationCard
                verified={status?.nin_verified ?? false}
                prefillNin={merchant?.nin}
                prefillFirstName={status?.first_name}
                prefillLastName={status?.last_name}
                prefillDob={status?.date_of_birth}
                onVerified={refetch}
              />
              <BvnVerificationCard
                verified={status?.bvn_verified ?? false}
                prefillBvn={merchant?.bvn}
                prefillFirstName={status?.first_name}
                prefillLastName={status?.last_name}
                prefillDob={status?.date_of_birth}
                prefillMobileNo={merchant?.phone}
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
});
