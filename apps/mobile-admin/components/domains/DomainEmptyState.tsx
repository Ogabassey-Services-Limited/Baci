import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

/** Convert a hex color to rgba with the given opacity (0–1). */
function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6 && cleaned.length !== 3) {
    return `rgba(0,0,0,${opacity})`;
  }
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const r = Number.parseInt(full.substring(0, 2), 16);
  const g = Number.parseInt(full.substring(2, 4), 16);
  const b = Number.parseInt(full.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(0,0,0,${opacity})`;
  }
  return `rgba(${r},${g},${b},${opacity})`;
}

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
            { backgroundColor: hexToRgba(colors.primary, 0.15) },
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

        <Pressable
          style={[styles.buyButton, { backgroundColor: colors.primary }]}
          onPress={onBuyDomain}
          accessibilityRole="button"
          accessibilityLabel="Get a custom domain"
        >
          <Text style={styles.buyButtonText}>Get a Custom Domain</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>

        <Pressable
          style={styles.connectLink}
          onPress={onConnectDomain}
          accessibilityRole="button"
          accessibilityLabel="I already own a domain"
        >
          <Text style={[styles.connectLinkText, { color: colors.primary }]}>
            I already own a domain
          </Text>
        </Pressable>
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
