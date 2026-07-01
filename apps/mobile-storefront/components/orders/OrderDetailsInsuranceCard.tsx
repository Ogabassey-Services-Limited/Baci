import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, TouchableOpacity, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { resolveInsuranceCardActions } from './OrderDetailsInsuranceCard.actions';
import {
  resolveDisplayClaimLabel,
  resolvePolicyStatusColors,
} from './OrderDetailsInsuranceCard.presenters';
import {
  InsuranceCardHeader,
  InsuranceClaimRow,
  InsuranceValueRow,
} from './OrderDetailsInsuranceCard.primitives';
import { INSURANCE_COLORS, styles } from './OrderDetailsInsuranceCard.styles';
import type {
  OrderDetailsInsuranceCardColors,
  OrderDetailsInsurancePolicy,
} from './OrderDetailsInsuranceCard.types';

export type { OrderDetailsInsurancePolicy } from './OrderDetailsInsuranceCard.types';

interface OrderDetailsInsuranceCardProps {
  colors: OrderDetailsInsuranceCardColors;
  hasAssuranceItems: boolean;
  insurancePolicy: OrderDetailsInsurancePolicy | null;
  isDelivered: boolean;
  isPaid: boolean;
  onCompleteInspection?: (inspectionUrl: string) => void;
  onFileClaim?: (claimUrl: string) => void;
  onFileClaimFallback?: () => void;
  onOpenCertificate: (certificateUrl: string) => void;
}

export function OrderDetailsInsuranceCard({
  colors,
  hasAssuranceItems,
  insurancePolicy,
  isDelivered,
  isPaid,
  onCompleteInspection,
  onFileClaim,
  onFileClaimFallback,
  onOpenCertificate,
}: OrderDetailsInsuranceCardProps) {
  if (!insurancePolicy) {
    if (!isPaid || !hasAssuranceItems) {
      return null;
    }

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <InsuranceCardHeader
          colors={colors}
          iconColor={colors.textSecondary}
          iconName="shield-outline"
        />
        <Text
          style={[
            styles.insuranceProvider,
            { color: colors.textSecondary, marginTop: 12 },
          ]}
        >
          Your shipping protection is being processed…
        </Text>
      </View>
    );
  }

  const policyColors = resolvePolicyStatusColors(insurancePolicy.status);
  const certificateUrl = insurancePolicy.certificate_url;
  // Pre-loss inspection ("Activate Protection") gates claims and can only
  // happen after delivery: show nothing actionable until delivered, then
  // "Activate Protection" until inspection is done, then "File a Claim".
  // Claim-only policies can inherit the DB default `pending`; treat that as an
  // inspection gate only while the hosted claim link is still absent.
  const {
    claimActionUrl,
    inspectionActionUrl,
    showActivationPending,
    showAwaitingDelivery,
    showClaim,
    showContinueClaim,
    showInspection,
  } = resolveInsuranceCardActions({
    claimComment: insurancePolicy.claim_comment,
    claimLink: insurancePolicy.claim_link,
    claimProgress: insurancePolicy.claim_progress,
    claimStage: insurancePolicy.claim_stage,
    claimStatus: insurancePolicy.claim_status,
    inspectionLink: insurancePolicy.inspection_link,
    inspectionStatus: insurancePolicy.inspection_status,
    isDelivered,
    onCompleteInspection,
    onFileClaim,
    onFileClaimFallback,
  });
  const handleFileClaimPress = () => {
    if (claimActionUrl) {
      onFileClaim?.(claimActionUrl);
      return;
    }
    onFileClaimFallback?.();
  };

  const claimLabel = resolveDisplayClaimLabel(
    insurancePolicy.claim_stage,
    insurancePolicy.claim_status
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <InsuranceCardHeader
        colors={colors}
        iconColor={INSURANCE_COLORS.active.foreground}
        iconName="shield-checkmark"
      />
      <View style={styles.insuranceContent}>
        {insurancePolicy.mycover_policy_number && (
          <InsuranceValueRow
            colors={colors}
            label="Policy No."
            value={insurancePolicy.mycover_policy_number}
          />
        )}
        <InsuranceValueRow
          colors={colors}
          label="Coverage"
          value={formatNgnCurrency(insurancePolicy.coverage_amount)}
        />
        <InsuranceValueRow
          colors={colors}
          label="Premium"
          value={formatNgnCurrency(insurancePolicy.premium_amount)}
        />
        <View style={styles.insuranceRow}>
          <Text
            style={[styles.insuranceLabel, { color: colors.textSecondary }]}
          >
            Status
          </Text>
          <View
            style={[
              styles.insuranceStatusBadge,
              { backgroundColor: policyColors.background },
            ]}
          >
            <Text
              style={[
                styles.insuranceStatusText,
                { color: policyColors.foreground },
              ]}
            >
              {insurancePolicy.status}
            </Text>
          </View>
        </View>
        <InsuranceClaimRow colors={colors} claimLabel={claimLabel} />
        {insurancePolicy.claim_progress && (
          <Text
            style={[styles.insuranceProvider, { color: colors.textSecondary }]}
          >
            {insurancePolicy.claim_progress}
          </Text>
        )}
        {insurancePolicy.claim_comment && (
          <Text
            style={[styles.insuranceProvider, { color: colors.textSecondary }]}
          >
            {insurancePolicy.claim_comment}
          </Text>
        )}
        <Text
          style={[styles.insuranceProvider, { color: colors.textSecondary }]}
        >
          Protected by MyCover.ai /{' '}
          {insurancePolicy.provider_name || 'Sovereign Trust Insurance Plc'}
        </Text>
        {certificateUrl && (
          <TouchableOpacity
            style={[
              styles.trackButton,
              {
                borderColor: INSURANCE_COLORS.active.foreground,
                marginTop: 12,
              },
            ]}
            onPress={() => onOpenCertificate(certificateUrl)}
            accessibilityRole="button"
            accessibilityLabel="Download insurance certificate"
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={INSURANCE_COLORS.active.foreground}
            />
            <Text
              style={[
                styles.trackButtonText,
                { color: INSURANCE_COLORS.active.foreground },
              ]}
            >
              Download Certificate
            </Text>
          </TouchableOpacity>
        )}
        {showInspection && (
          <TouchableOpacity
            style={[
              styles.fileClaimButton,
              // Primary CTA uses the merchant brand color, not a status green.
              { backgroundColor: BRAND.primary },
            ]}
            onPress={() => {
              if (inspectionActionUrl) {
                onCompleteInspection?.(inspectionActionUrl);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Activate protection with a device inspection"
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={INSURANCE_COLORS.cta.foreground}
            />
            <Text
              style={[
                styles.trackButtonText,
                { color: INSURANCE_COLORS.cta.foreground },
              ]}
            >
              Activate Protection
            </Text>
          </TouchableOpacity>
        )}
        {showActivationPending && (
          <Text
            style={[
              styles.insuranceProvider,
              { color: colors.textSecondary, marginTop: 12 },
            ]}
          >
            Protection activation is pending while MyCover prepares your device
            inspection link.
          </Text>
        )}
        {showAwaitingDelivery && (
          <Text
            style={[
              styles.insuranceProvider,
              { color: colors.textSecondary, marginTop: 12 },
            ]}
          >
            Protection activates after delivery — you'll be able to complete a
            quick device inspection then.
          </Text>
        )}
        {(showClaim || showContinueClaim) && (
          <TouchableOpacity
            style={[
              styles.fileClaimButton,
              // Primary CTA uses the merchant brand color, not a status green.
              { backgroundColor: BRAND.primary },
            ]}
            onPress={handleFileClaimPress}
            accessibilityRole="button"
            accessibilityLabel={
              showContinueClaim
                ? 'Continue insurance claim'
                : 'File an insurance claim'
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={INSURANCE_COLORS.cta.foreground}
            />
            <Text
              style={[
                styles.trackButtonText,
                { color: INSURANCE_COLORS.cta.foreground },
              ]}
            >
              {showContinueClaim ? 'Continue Claim' : 'File a Claim'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
