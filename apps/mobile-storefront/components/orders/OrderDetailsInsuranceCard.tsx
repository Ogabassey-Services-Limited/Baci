import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { resolveInsuranceCardActions } from './OrderDetailsInsuranceCard.actions';
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
  onOpenCertificate,
}: OrderDetailsInsuranceCardProps) {
  if (!insurancePolicy) {
    if (!isPaid || !hasAssuranceItems) {
      return null;
    }

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.insuranceHeader}>
          <Ionicons
            name="shield-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginBottom: 0, marginLeft: 8 },
            ]}
          >
            Insurance Coverage
          </Text>
        </View>
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

  const policyColors =
    insurancePolicy.status === 'active'
      ? INSURANCE_COLORS.active
      : INSURANCE_COLORS.pending;
  const certificateUrl = insurancePolicy.certificate_url;
  const claimUrl = insurancePolicy.claim_link;
  const inspectionUrl = insurancePolicy.inspection_link;
  // Pre-loss inspection ("Activate Protection") gates claims and can only
  // happen after delivery: show nothing actionable until delivered, then
  // "Activate Protection" until inspection is done, then "File a Claim".
  // Claim-only policies can inherit the DB default `pending`; treat that as an
  // inspection gate only while the hosted claim link is still absent.
  const {
    showActivationPending,
    showAwaitingDelivery,
    showClaim,
    showContinueClaim,
    showInspection,
  } = resolveInsuranceCardActions({
    claimComment: insurancePolicy.claim_comment,
    claimLink: claimUrl,
    claimStage: insurancePolicy.claim_stage,
    claimStatus: insurancePolicy.claim_status,
    inspectionLink: inspectionUrl,
    inspectionStatus: insurancePolicy.inspection_status,
    isDelivered,
    onCompleteInspection,
    onFileClaim,
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.insuranceHeader}>
        <Ionicons
          name="shield-checkmark"
          size={20}
          color={INSURANCE_COLORS.active.foreground}
        />
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginBottom: 0, marginLeft: 8 },
          ]}
        >
          Insurance Coverage
        </Text>
      </View>
      <View style={styles.insuranceContent}>
        {insurancePolicy.mycover_policy_number && (
          <View style={styles.insuranceRow}>
            <Text
              style={[styles.insuranceLabel, { color: colors.textSecondary }]}
            >
              Policy No.
            </Text>
            <Text style={[styles.insuranceValue, { color: colors.text }]}>
              {insurancePolicy.mycover_policy_number}
            </Text>
          </View>
        )}
        <View style={styles.insuranceRow}>
          <Text
            style={[styles.insuranceLabel, { color: colors.textSecondary }]}
          >
            Coverage
          </Text>
          <Text style={[styles.insuranceValue, { color: colors.text }]}>
            {formatNgnCurrency(insurancePolicy.coverage_amount)}
          </Text>
        </View>
        <View style={styles.insuranceRow}>
          <Text
            style={[styles.insuranceLabel, { color: colors.textSecondary }]}
          >
            Premium
          </Text>
          <Text style={[styles.insuranceValue, { color: colors.text }]}>
            {formatNgnCurrency(insurancePolicy.premium_amount)}
          </Text>
        </View>
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
        {insurancePolicy.claim_status && (
          <View style={styles.insuranceRow}>
            <Text
              style={[styles.insuranceLabel, { color: colors.textSecondary }]}
            >
              Claim
            </Text>
            <Text
              style={[
                styles.insuranceValue,
                { color: colors.text, textTransform: 'capitalize' },
              ]}
            >
              {insurancePolicy.claim_stage ||
                insurancePolicy.claim_status.replace(/_/g, ' ')}
            </Text>
          </View>
        )}
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
              { backgroundColor: INSURANCE_COLORS.active.foreground },
            ]}
            onPress={() => onCompleteInspection?.(inspectionUrl as string)}
            accessibilityRole="button"
            accessibilityLabel="Activate protection with a device inspection"
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#ffffff"
            />
            <Text style={[styles.trackButtonText, { color: '#ffffff' }]}>
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
              { backgroundColor: INSURANCE_COLORS.active.foreground },
            ]}
            onPress={() => onFileClaim?.(claimUrl as string)}
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
              color="#ffffff"
            />
            <Text style={[styles.trackButtonText, { color: '#ffffff' }]}>
              {showContinueClaim ? 'Continue Claim' : 'File a Claim'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
