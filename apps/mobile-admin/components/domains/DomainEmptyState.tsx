import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface DomainEmptyStateProps {
  onBuyDomain?: () => void;
  onConnectDomain: () => void;
}

export function DomainEmptyState({
  onBuyDomain,
  onConnectDomain,
}: DomainEmptyStateProps) {
  const { colors, shadows } = useTheme();

  return (
    <View style={styles.promoContainer}>
      <View
        style={[
          styles.promoCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.promoIconCircle,
            { backgroundColor: colors.primaryLight },
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

        {onBuyDomain ? (
          <Pressable
            style={({ pressed }) => [
              styles.buyButton,
              shadows.md,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onBuyDomain}
            accessibilityRole="button"
            accessibilityLabel="Get a custom domain"
          >
            <Text
              style={[styles.buyButtonText, { color: colors.textOnPrimary }]}
            >
              Get a Custom Domain
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.textOnPrimary}
            />
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.connectLink,
            pressed && { opacity: 0.7 },
          ]}
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
  },
  buyButtonText: {
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
