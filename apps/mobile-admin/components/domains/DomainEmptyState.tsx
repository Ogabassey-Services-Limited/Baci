import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface DomainEmptyStateProps {
  onBuyDomain: () => void;
  onConnectDomain: () => void;
}

export function DomainEmptyState({
  onBuyDomain,
  onConnectDomain,
}: DomainEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.promoContainer}>
      <View style={[styles.promoCard, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.promoIconCircle,
            { backgroundColor: `${colors.primary}15` },
          ]}
        >
          <Ionicons name="rocket" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.promoTitle, { color: colors.text }]}>
          Claim your brand online
        </Text>
        <Text style={[styles.promoText, { color: colors.textSecondary }]}>
          Merchants with custom domains (e.g. .com) establish more trust and
          look more professional to customers.
        </Text>

        <TouchableOpacity
          style={[styles.buyButton, { backgroundColor: colors.primary }]}
          onPress={onBuyDomain}
        >
          <Text style={styles.buyButtonText}>Get a Custom Domain</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.connectLink} onPress={onConnectDomain}>
          <Text style={[styles.connectLinkText, { color: colors.primary }]}>
            I already own a domain
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  promoContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  promoCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  promoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  promoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  promoText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    width: '100%',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buyButtonText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
    marginRight: 8,
  },
  connectLink: {
    paddingVertical: 8,
  },
  connectLinkText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
