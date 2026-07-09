import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import gigLogoSource from '@/assets/images/gig-logo-dark.png';
import type { ShippingQuote } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { RADIUS } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingQuoteRowProps {
  colors: ColorsScheme;
  isSelected: boolean;
  leadingIcon?: IoniconsIconName;
  onSelect: (id: string) => void;
  quote: ShippingQuote;
  selectedAccentColor: string;
  selectedBackgroundColor: string;
}

export function ShippingQuoteRow({
  colors,
  isSelected,
  leadingIcon,
  onSelect,
  quote,
  selectedAccentColor,
  selectedBackgroundColor,
}: ShippingQuoteRowProps) {
  const eta =
    quote.deliveryRange ||
    (quote.estimatedDays ? `${quote.estimatedDays} days` : 'ETA unavailable');
  const carrier = quote.carrierName || quote.provider || 'Delivery';
  const stationCode = quote.stationCode ?? quote.pickupStationCode;
  const metaLines = [
    carrier,
    stationCode ? `Station code: ${stationCode}` : undefined,
    `Est. ${eta}`,
  ].filter((line): line is string => Boolean(line));
  const normalizedCarrier = carrier.trim().toLowerCase();
  const isGiglQuote =
    quote.provider?.trim().toLowerCase() === 'gigl' ||
    normalizedCarrier === 'gigl' ||
    normalizedCarrier === 'gig logistics';
  const accessibilityDetails = [...metaLines, formatPrice(quote.price)].join(
    '. '
  );

  return (
    <Pressable
      onPress={() => onSelect(String(quote.id))}
      style={[
        styles.quoteRow,
        {
          borderColor: isSelected ? selectedAccentColor : colors.border,
          backgroundColor: isSelected ? selectedBackgroundColor : colors.card,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${quote.displayName}. ${accessibilityDetails}`}
      accessibilityState={{ selected: isSelected }}
    >
      {isGiglQuote ? (
        <View style={[styles.logoBadge, styles.gigLogoBadge]}>
          <Image
            accessibilityLabel="GIG Logistics logo"
            accessibilityRole="image"
            accessible
            source={gigLogoSource}
            style={styles.gigLogo}
            resizeMode="contain"
          />
        </View>
      ) : leadingIcon ? (
        <View
          style={[
            styles.logoBadge,
            { backgroundColor: `${selectedAccentColor}14` },
          ]}
        >
          <Ionicons name={leadingIcon} size={22} color={selectedAccentColor} />
        </View>
      ) : null}
      <View style={styles.quoteInfo}>
        <View style={styles.quoteHeader}>
          <Text
            style={[styles.quoteTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {quote.displayName}
          </Text>
          {normalizedCarrier === 'topship' && (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>
                Topship
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.quoteMeta, { color: colors.textSecondary }]}
          numberOfLines={stationCode ? 3 : 2}
        >
          {metaLines.join('\n')}
        </Text>
      </View>
      <View style={styles.quoteRight}>
        <Text style={[styles.quotePrice, { color: colors.text }]}>
          {formatPrice(quote.price)}
        </Text>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={isSelected ? selectedAccentColor : colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quoteRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  quoteInfo: { flex: 1, marginRight: 12, minWidth: 0 },
  quoteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  quoteTitle: { flex: 1, flexShrink: 1, fontSize: 13, fontWeight: '700' },
  quoteMeta: { fontSize: 12 },
  quoteRight: { alignItems: 'flex-end', gap: 4 },
  quotePrice: { fontSize: 14, fontWeight: '700' },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  logoBadge: {
    alignItems: 'center',
    borderRadius: 4,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
    width: 44,
  },
  gigLogoBadge: { backgroundColor: '#000000' },
  gigLogo: { height: 22, width: 30 },
});
