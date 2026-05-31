import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';

export interface OrderDetailsInsurancePolicy {
  certificate_url: string | null;
  claim_status: string | null;
  coverage_amount: number;
  mycover_policy_number: string | null;
  policy_expiry_date: string | null;
  policy_start_date: string | null;
  policy_type: string | null;
  premium_amount: number;
  provider_name: string | null;
  status: string;
}

interface OrderDetailsInsuranceCardColors {
  card: string;
  text: string;
  textSecondary: string;
}

interface OrderDetailsInsuranceCardProps {
  colors: OrderDetailsInsuranceCardColors;
  hasAssuranceItems: boolean;
  insurancePolicy: OrderDetailsInsurancePolicy | null;
  isPaid: boolean;
  onOpenCertificate: (certificateUrl: string) => void;
}

const INSURANCE_COLORS = {
  active: {
    background: '#DCFCE7',
    foreground: '#059669',
  },
  pending: {
    background: '#FEF3C7',
    foreground: '#D97706',
  },
} as const;

export function OrderDetailsInsuranceCard({
  colors,
  hasAssuranceItems,
  insurancePolicy,
  isPaid,
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
              {insurancePolicy.claim_status}
            </Text>
          </View>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceContent: {
    marginTop: 12,
    gap: 10,
  },
  insuranceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insuranceLabel: {
    fontSize: 14,
  },
  insuranceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  insuranceStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insuranceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  insuranceProvider: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
