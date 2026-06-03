import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { WALLET_COLORS } from './wallet.colors';
import { styles } from './wallet.styles';

type WalletActionColors = Pick<(typeof Colors)['light'], 'border' | 'text'>;

interface WalletPanelActionButtonsProps {
  cancelAccessibilityLabel: string;
  confirmAccessibilityLabel: string;
  confirmText: string;
  colors: WalletActionColors;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WalletPanelActionButtons({
  cancelAccessibilityLabel,
  confirmAccessibilityLabel,
  confirmText,
  colors,
  isPending,
  onCancel,
  onConfirm,
}: WalletPanelActionButtonsProps) {
  return (
    <View style={styles.redeemPanelActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelAccessibilityLabel}
        style={({ pressed }) => [
          styles.cancelBtn,
          { borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
        onPress={onCancel}
      >
        <Text style={[styles.cancelBtnText, { color: colors.text }]}>
          Cancel
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={confirmAccessibilityLabel}
        accessibilityState={{
          disabled: isPending,
          busy: isPending,
        }}
        style={({ pressed }) => [
          styles.confirmBtn,
          {
            backgroundColor: BRAND.primary,
            opacity: isPending ? 0.5 : 1,
          },
          pressed && !isPending && { opacity: 0.7 },
        ]}
        onPress={onConfirm}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color={WALLET_COLORS.white} />
        ) : (
          <Text style={styles.confirmBtnText}>{confirmText}</Text>
        )}
      </Pressable>
    </View>
  );
}
