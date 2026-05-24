import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import type { CartItem } from '@/stores/cart-store';
import styles from './styles';

interface NegotiationButtonProps {
  item: CartItem;
  openItemNegotiation?: (item: CartItem) => void;
  colors: (typeof Colors)['light'];
  negotiateSurface: string;
  negotiateBorder: string;
}

export default function NegotiationButton({
  item,
  openItemNegotiation,
  colors,
  negotiateSurface,
  negotiateBorder,
}: NegotiationButtonProps) {
  if (!openItemNegotiation) return null;

  if (item.negotiationStatus === 'accepted') {
    return (
      <View
        style={[
          styles.negotiatedBadge,
          {
            backgroundColor: colors.background,
            borderColor: colors.success,
          },
        ]}
      >
        <Ionicons name="checkmark" size={12} color={colors.success} />
        <Text style={[styles.negotiatedBadgeText, { color: colors.success }]}>
          Matched
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.negotiateButton,
        {
          backgroundColor: negotiateSurface,
          borderColor: negotiateBorder,
        },
      ]}
      onPress={() => openItemNegotiation?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`Negotiate price for ${item.name}`}
      accessibilityHint="Opens negotiation for this item"
    >
      <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
      <Text style={styles.negotiateButtonText}>Negotiate</Text>
    </Pressable>
  );
}
