import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const PICKUP_STATION_ADDRESS_LINES = [
  'Taiyelolu Towers',
  'First Floor',
  '2 Olaide Tomori Street Ikeja Lagos',
] as const;
export const PICKUP_STATION_CITY = 'Ikeja';
export const PICKUP_STATION_STATE = 'Lagos';

type ColorsScheme = (typeof Colors)['light'];

interface PickupStationCardProps {
  colors: ColorsScheme;
  isDark: boolean;
}

export function PickupStationCard({ colors, isDark }: PickupStationCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Ionicons name="location-outline" size={16} color={BRAND.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Pick Up Station
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Your order will be ready for collection at:
        </Text>
        {PICKUP_STATION_ADDRESS_LINES.map((line) => (
          <Text key={line} style={[styles.summaryLine, { color: colors.text }]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  helperText: {
    fontSize: 12,
  },
  summaryLine: {
    fontSize: 14,
    lineHeight: 20,
  },
});
