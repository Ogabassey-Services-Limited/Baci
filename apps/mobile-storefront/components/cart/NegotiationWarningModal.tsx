import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import type { CartItem } from '@/stores/cart-store';
import styles from './styles';

interface NegotiationWarningModalProps {
  visible: boolean;
  pendingItem: CartItem | null;
  onClose: () => void;
  onNegotiateItem: (item: CartItem) => void;
  onBulkNegotiate: () => void;
  triggerHaptic: () => void;
  colors: (typeof Colors)['light'];
}

export default function NegotiationWarningModal({
  visible,
  pendingItem,
  onClose,
  onNegotiateItem,
  onBulkNegotiate,
  triggerHaptic,
  colors,
}: NegotiationWarningModalProps): React.JSX.Element {
  const canNegotiateItem = !!pendingItem;
  const handleNegotiateItemPress = () => {
    if (!pendingItem) {
      return;
    }
    triggerHaptic();
    onNegotiateItem(pendingItem);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View style={styles.warningOverlay}>
        <Pressable
          style={styles.warningBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <View style={[styles.warningModal, { backgroundColor: colors.card }]}>
          <View style={styles.warningHeader}>
            <View
              style={[
                styles.warningIconCircle,
                { backgroundColor: colors.background },
              ]}
            >
              <Ionicons name="cash-outline" size={24} color={colors.warning} />
            </View>
            <Text style={[styles.warningTitle, { color: colors.text }]}>
              Choose Negotiation Mode
            </Text>
          </View>

          <Text
            style={[styles.warningDescription, { color: colors.textSecondary }]}
          >
            Negotiating items individually will disable bulk cart negotiation.
            <Text style={styles.warningDescriptionBold}>
              {' '}
              You can only use one approach.
            </Text>
          </Text>

          <View style={styles.warningButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.warningPrimaryButton,
                !canNegotiateItem && styles.warningButtonDisabled,
                pressed && canNegotiateItem && styles.warningButtonPressed,
              ]}
              onPress={handleNegotiateItemPress}
              disabled={!canNegotiateItem}
              accessibilityRole="button"
              accessibilityLabel="Negotiate this item"
              accessibilityState={{ disabled: !canNegotiateItem }}
            >
              <Text
                style={[
                  styles.warningPrimaryButtonText,
                  { color: colors.primaryForeground },
                ]}
              >
                Negotiate This Item
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.warningSecondaryButton,
                { backgroundColor: colors.muted, borderColor: colors.border },
                pressed && styles.warningButtonPressed,
              ]}
              onPress={() => {
                triggerHaptic();
                onBulkNegotiate();
              }}
              accessibilityRole="button"
              accessibilityLabel="Bulk negotiate entire cart"
            >
              <Ionicons name="cash-outline" size={18} color={colors.text} />
              <Text
                style={[
                  styles.warningSecondaryButtonText,
                  { color: colors.text },
                ]}
              >
                Bulk Negotiate Entire Cart
              </Text>
            </Pressable>

            <Pressable
              style={styles.warningCancelButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel negotiation mode"
            >
              <Text
                style={[
                  styles.warningCancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
