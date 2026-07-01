import type { NegotiationCartLine } from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { formatCurrency as formatPrice } from '@/utils/format';
import { formatNegotiationItemMeta } from './format-negotiation-item-meta';
import { negotiationCardStyles as styles } from './NegotiationCard.styles';

interface NegotiationCartSnapshotColors {
  border: string;
  text: string;
  textSecondary: string;
}

interface NegotiationCartSnapshotProps {
  cartSnapshot: NegotiationCartLine[];
  colors: NegotiationCartSnapshotColors;
  expanded: boolean;
  negotiationId: string;
  onToggleCart: (id: string) => void;
}

function buildCartToggleLabel(count: number, expanded: boolean) {
  if (expanded) {
    return {
      accessibilityLabel: 'Hide cart items',
      visibleLabel: 'Hide items',
    };
  }

  const itemWord = count === 1 ? 'item' : 'items';
  return {
    accessibilityLabel: `View ${count} cart ${itemWord}`,
    visibleLabel: `View ${count} ${itemWord}`,
  };
}

function formatCartLineMeta(line: NegotiationCartLine): string | null {
  return formatNegotiationItemMeta({
    name: line.name,
    variant_name: line.variant_name,
    condition: line.condition,
  });
}

export function NegotiationCartSnapshot({
  cartSnapshot,
  colors,
  expanded,
  negotiationId,
  onToggleCart,
}: NegotiationCartSnapshotProps) {
  const toggleLabel = buildCartToggleLabel(cartSnapshot.length, expanded);

  return (
    <View style={styles.cartSection}>
      <Pressable
        style={styles.cartToggle}
        onPress={() => onToggleCart(negotiationId)}
        accessibilityRole="button"
        accessibilityLabel={toggleLabel.accessibilityLabel}
      >
        <Ionicons name="cart-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.cartToggleText, { color: colors.textSecondary }]}>
          {toggleLabel.visibleLabel}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={[styles.cartItems, { borderTopColor: colors.border }]}>
          {cartSnapshot.map((line) => {
            const lineMeta = formatCartLineMeta(line);
            return (
              <View
                key={`${line.product_id}-${line.variant_id ?? 'base'}-${line.name}-${line.quantity}-${line.price}-${line.condition ?? 'any'}`}
                style={styles.cartLine}
              >
                <Text
                  style={[styles.cartLineQty, { color: colors.textSecondary }]}
                >
                  {line.quantity}×
                </Text>
                <View style={styles.cartLineBody}>
                  <Text
                    style={[styles.cartLineName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {line.name}
                  </Text>
                  {lineMeta ? (
                    <Text
                      style={[
                        styles.cartLineMeta,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {lineMeta}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.cartLinePrice, { color: colors.text }]}>
                  {formatPrice(line.price * line.quantity)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
