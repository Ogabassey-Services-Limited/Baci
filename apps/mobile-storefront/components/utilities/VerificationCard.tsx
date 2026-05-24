import Ionicons from "@react-native-vector-icons/ionicons/static";
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface VerificationCardProps {
  verified: boolean;
  customerName?: string;
  message?: string;
  isLoading: boolean;
}

export function VerificationCard({
  verified,
  customerName,
  message,
  isLoading,
}: VerificationCardProps) {
  if (isLoading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color="#6B7280" />
        <Text style={styles.loadingText}>Verifying customer...</Text>
      </View>
    );
  }

  if (verified) {
    return (
      <View style={[styles.card, styles.successCard]}>
        <Ionicons name="checkmark-circle" size={20} color="#059669" />
        <View>
          <Text style={styles.successName}>{customerName}</Text>
          <Text style={styles.successLabel}>Customer verified</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.errorCard]}>
      <Ionicons name="close-circle" size={20} color="#DC2626" />
      <Text style={styles.errorText}>{message || 'Verification failed'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  loadingCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  successCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  successName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  successLabel: {
    fontSize: 12,
    color: '#059669',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
});
