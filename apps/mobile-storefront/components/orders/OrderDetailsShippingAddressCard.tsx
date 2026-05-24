import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';

export interface OrderDetailsShippingAddress {
  address?: string | null;
  city?: string | null;
  name?: string | null;
  phone?: string | null;
  state?: string | null;
}

interface OrderDetailsShippingAddressCardColors {
  card: string;
  text: string;
  textSecondary: string;
}

interface OrderDetailsShippingAddressCardProps {
  colors: OrderDetailsShippingAddressCardColors;
  isDark: boolean;
  shippingAddress: OrderDetailsShippingAddress | null | undefined;
}

export function OrderDetailsShippingAddressCard({
  colors,
  isDark,
  shippingAddress,
}: OrderDetailsShippingAddressCardProps) {
  const cityState = [shippingAddress?.city, shippingAddress?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Shipping Address
      </Text>
      <View style={styles.addressContent}>
        <View
          style={[
            styles.addressIconRail,
            {
              backgroundColor: isDark
                ? 'rgba(217, 59, 48, 0.14)'
                : `${BRAND.primary}12`,
            },
          ]}
        >
          <Ionicons
            name="location"
            size={18}
            color={BRAND.primary}
            style={styles.locationIcon}
          />
        </View>

        <View style={styles.addressDetails}>
          {!!shippingAddress?.name && (
            <Text style={[styles.addressName, { color: colors.text }]}>
              {shippingAddress.name}
            </Text>
          )}
          {!!shippingAddress?.phone && (
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {shippingAddress.phone}
            </Text>
          )}
          {!!shippingAddress?.address && (
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {shippingAddress.address}
            </Text>
          )}
          {!!cityState && (
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {cityState}
            </Text>
          )}
        </View>
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
  addressIconRail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressDetails: {
    flex: 1,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressLine: {
    fontSize: 14,
    marginTop: 2,
  },
  locationIcon: {
    textAlign: 'center',
    marginLeft: 1,
  },
});
