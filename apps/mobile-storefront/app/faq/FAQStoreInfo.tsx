import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import type { StoreHour } from './faq-data';

interface FAQStoreInfoProps {
  address: string;
  cardColor: string;
  hours: readonly StoreHour[];
  secondaryTextColor: string;
  textColor: string;
}

export function FAQStoreInfo({
  address,
  cardColor,
  hours,
  secondaryTextColor,
  textColor,
}: FAQStoreInfoProps) {
  return (
    <View style={[styles.container, { backgroundColor: cardColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Store Hours</Text>
      {hours.map((hour) => (
        <Text
          key={hour.id}
          style={[styles.text, { color: secondaryTextColor }]}
        >
          {hour.label}
        </Text>
      ))}
      <View
        style={styles.addressRow}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Address: ${address}`}
      >
        <Ionicons
          name="location-outline"
          size={16}
          color={secondaryTextColor}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text
          style={[styles.text, { color: secondaryTextColor }]}
          accessible={false}
        >
          {address}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.sm,
  },
  text: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
});
