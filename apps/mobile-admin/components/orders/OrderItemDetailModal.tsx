import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface OrderItemSnapshot {
  id: string;
  image_url?: string;
  name: string;
  price: number;
  product_id?: string;
  quantity: number;
  variant_name?: string;
}

interface OrderItemDetailModalProps {
  formattedLineTotal: string;
  formattedUnitPrice: string;
  item: OrderItemSnapshot | null;
  onClose: () => void;
  visible: boolean;
}

export function OrderItemDetailModal({
  formattedLineTotal,
  formattedUnitPrice,
  item,
  onClose,
  visible,
}: OrderItemDetailModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible || !item) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, SPACING.lg),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Item Details
            </Text>
            <Pressable
              accessibilityLabel="Close item details"
              hitSlop={8}
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: colors.backgroundLight },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <Text style={[styles.note, { color: colors.textSecondary }]}>
            This is the order snapshot the customer actually bought.
          </Text>

          <View style={styles.heroRow}>
            <View
              style={[
                styles.imageWrap,
                { backgroundColor: colors.backgroundLight },
              ]}
            >
              {item.image_url ? (
                <SafeImage source={{ uri: item.image_url }} style={styles.image} />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={colors.textMuted}
                />
              )}
            </View>

            <View style={styles.heroDetails}>
              <Text style={[styles.itemName, { color: colors.text }]}>
                {item.name}
              </Text>
              {item.variant_name ? (
                <Text
                  style={[styles.variantName, { color: colors.textSecondary }]}
                >
                  {item.variant_name}
                </Text>
              ) : (
                <Text
                  style={[styles.variantName, { color: colors.textSecondary }]}
                >
                  No variant snapshot
                </Text>
              )}
            </View>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <DetailRow
              label="Quantity"
              value={`x${item.quantity}`}
              colors={colors}
            />
            <DetailRow
              label="Unit price"
              value={formattedUnitPrice}
              colors={colors}
            />
            <DetailRow
              label="Line total"
              value={formattedLineTotal}
              colors={colors}
              isStrong
            />
            <DetailRow
              label="SKU"
              value={
                item.product_id && !item.product_id.startsWith('custom-')
                  ? item.product_id.slice(0, 8).toUpperCase()
                  : 'Custom item'
              }
              colors={colors}
            />
          </View>

          <Pressable
            accessibilityLabel="Close item detail sheet"
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  colors,
  isStrong = false,
  label,
  value,
}: {
  colors: Record<string, string>;
  isStrong?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.detailValue,
          { color: colors.text },
          isStrong ? styles.detailValueStrong : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
    maxHeight: Platform.OS === 'web' ? 560 : '72%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  note: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 20,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  imageWrap: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 84,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 84,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  heroDetails: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
    lineHeight: 22,
  },
  variantName: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '600',
  },
  detailValueStrong: {
    fontWeight: '700',
  },
  doneButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
  },
});
